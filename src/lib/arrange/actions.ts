import { createServiceClient } from '@/lib/supabase/service'
import { getJobNotifData } from '@/lib/supabase/queries/notifications'
import { computeCrewClashes } from '@/lib/supabase/queries/crew-clash'
import { missingForStage } from '@/lib/utils/job-stage-rules'
import {
  validateGuide, guideJobPatch, validateOffer, hhmm, clashKeys, newClashKeys,
  offerMatchesJob, offerHasCrew, clientOkSchedulerMessage, arrangeClearPatch,
  parseGuideInput, idList, reasonText,
  type ArrangeAction, type ArrangeState, type Arrangement, type ArrangeOffer, type ArrangeReturn, type Slot,
} from '@/lib/utils/arrange-rules'
import { guideLabel, slotLabel } from '@/lib/utils/arrange-labels'
import { sendTelegram } from '@/lib/telegram/bot'
import {
  tplArrangeReady, tplArrangeOffered, tplArrangeReturned, tplArrangeClientOk,
  tplJobAssigned, tplSubInstallerAssigned, tplNewJobCreated,
} from '@/lib/telegram/templates'
import { alertSchedulers, alertSalesSide } from './notify'
import type { Json, Punctuality } from '@/lib/supabase/types'

/**
 * To arrange — what each button does (spec 2026-11-04-to-arrange-design.md).
 * The route has already checked: the caller can see the job, it is Ongoing,
 * they are on the right side for this action, and the move is valid from the
 * current state. Everything here writes on the SERVICE key, every write is
 * conditional on the job still being in the state that was read (two people
 * pressing at once → the second gets state_changed), and every write checks a
 * row came back (an RLS- or filter-skipped UPDATE is not an error).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

export const ARRANGE_JOB_SELECT =
  'id, status, date, date_end, time_start, time_end, punctuality, project_title, client, client_poc_name, ' +
  'client_poc_phone, location, created_by, sales_poc_id, scheduled_at, arrange_state, arrangement, job_coordinators(user_id)'

export type ArrangeJobRow = {
  id: string; status: string; date: string | null; date_end: string | null
  time_start: string | null; time_end: string | null; punctuality: Punctuality
  project_title: string | null; client: string; client_poc_name: string | null; client_poc_phone: string | null
  location: string; created_by: string | null; sales_poc_id: string | null; scheduled_at: string | null
  arrange_state: string | null; arrangement: Json | null
  job_coordinators: Array<{ user_id: string }>
}

export type ArrangeCtx = {
  job: ArrangeJobRow
  state: ArrangeState | null
  arrangement: Arrangement | null
  viewer: { id: string; name: string }
}

export type ArrangeResult = { status: number; body: Record<string, unknown> }

const ok = (state: ArrangeState | null, extra: Record<string, unknown> = {}): ArrangeResult =>
  ({ status: 200, body: { ok: true, state, ...extra } })
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ArrangeResult =>
  ({ status, body: { error, ...extra } })
const stateChanged = () => fail(409, 'state_changed')

const todaySG = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
const nowISO = () => new Date().toISOString()
const titleOf = (j: ArrangeJobRow) => j.project_title || j.client
const jobUrl = (j: ArrangeJobRow) => `${APP_URL}/jobs/${j.id}`
const slotOf = (j: ArrangeJobRow): Slot =>
  ({ date: j.date, dateEnd: j.date_end, timeStart: hhmm(j.time_start), timeEnd: hhmm(j.time_end) })
const salesTarget = (j: ArrangeJobRow) =>
  ({ id: j.id, sales_poc_id: j.sales_poc_id, coordinatorIds: j.job_coordinators.map(c => c.user_id) })

/** The job's own update, only if it is still Ongoing AND still in the state
 *  this request read. False = someone else moved it first. */
async function writeIf(ctx: ArrangeCtx, patch: Record<string, unknown>): Promise<boolean> {
  const svc = createServiceClient()
  const base = svc.from('jobs').update(patch as never)
    .eq('id', ctx.job.id)
    .eq('status', 'awaiting_date') // raw status — see job-stage.ts
  const q = ctx.state === null ? base.is('arrange_state', null) : base.eq('arrange_state', ctx.state)
  const { data, error } = await q.select('id')
  if (error) console.error('[arrange] write refused', ctx.job.id, error)
  return !error && (data ?? []).length > 0
}

function returned(ctx: ArrangeCtx, kind: ArrangeReturn['kind'], text: string | null): ArrangeReturn {
  return { kind, text, by: ctx.viewer.id, byName: ctx.viewer.name, at: nowISO() }
}

// ── Sales: ready / edit the guide ───────────────────────────────────────────

async function ready(ctx: ArrangeCtx, body: Record<string, unknown>): Promise<ArrangeResult> {
  const g = parseGuideInput(body)
  if (!g) return fail(400, 'bad_request')
  const bad = validateGuide(g)
  if (bad) return fail(400, `bad_guide:${bad}`)
  const missing = missingForStage('ongoing', ctx.job)
  if (missing.length) return fail(422, 'missing_fields', { fields: missing })

  const arrangement: Arrangement = {
    readyBy: ctx.viewer.id, readyByName: ctx.viewer.name, readyAt: nowISO(),
    day: g.day, timeStart: hhmm(g.timeStart), timeEnd: hhmm(g.timeEnd), note: g.note,
    offer: null, lastReturn: null,
  }
  const patch = { ...guideJobPatch(g, ctx.job.punctuality), arrange_state: 'needs_date', arrangement }
  if (!(await writeIf(ctx, patch))) return stateChanged()

  await alertSchedulers(ctx.job.id,
    { type: 'arrange_ready', title: `Ready to arrange: ${titleOf(ctx.job)}`, body: `${guideLabel(arrangement)} · Sales: ${ctx.viewer.name}` },
    tplArrangeReady({
      projectTitle: ctx.job.project_title, jobClient: ctx.job.client, jobUrl: jobUrl(ctx.job),
      salesName: ctx.viewer.name, guide: guideLabel(arrangement), note: arrangement.note, location: ctx.job.location,
    }))
  return ok('needs_date')
}

// ── Scheduler: offer a slot ─────────────────────────────────────────────────

async function offer(ctx: ArrangeCtx, body: Record<string, unknown>): Promise<ArrangeResult> {
  const arr = ctx.arrangement
  if (!arr) return stateChanged()
  const missing = missingForStage('scheduled', ctx.job)
  if (missing.length) return fail(422, 'missing_fields', { fields: missing })
  // The page saves the date/time onto the job first; the offer is what is SAVED.
  const slot = slotOf(ctx.job)
  const bad = validateOffer(arr, slot, todaySG())
  if (bad) return fail(400, `bad_offer:${bad}`)

  const driverIds  = idList(body.driverIds)
  const supportIds = idList(body.supportIds).filter(id => !driverIds.includes(id))
  const svc = createServiceClient()
  const { data: ext, error: extErr } = await svc.from('job_external_contacts')
    .select('contact_id').eq('job_id', ctx.job.id) as { data: Array<{ contact_id: string }> | null; error: unknown }
  if (extErr) return fail(500, 'read_failed')
  const contactIds = (ext ?? []).map(r => r.contact_id)

  // The clashes he is offering past are recorded here, computed on the
  // server — never taken from the browser.
  const clashes = await computeCrewClashes(svc, {
    jobId: ctx.job.id, date: slot.date!, dateEnd: slot.dateEnd, timeStart: slot.timeStart, timeEnd: slot.timeEnd,
    punctuality: ctx.job.punctuality, driverIds, supportIds,
  })

  const people = [...driverIds, ...supportIds]
  const { data: users } = people.length
    ? await svc.from('users').select('id, name').in('id', people) as { data: Array<{ id: string; name: string }> | null }
    : { data: [] as Array<{ id: string; name: string }> }
  const { data: contacts } = contactIds.length
    ? await svc.from('external_contacts').select('id, name').in('id', contactIds) as { data: Array<{ id: string; name: string }> | null }
    : { data: [] as Array<{ id: string; name: string }> }
  const nameOf = new Map([...(users ?? []), ...(contacts ?? [])].map(u => [u.id, u.name]))
  const crewNames = [...people, ...contactIds].map(id => nameOf.get(id)).filter((n): n is string => !!n)

  const theOffer: ArrangeOffer = {
    by: ctx.viewer.id, byName: ctx.viewer.name, at: nowISO(),
    date: slot.date!, dateEnd: slot.dateEnd, timeStart: slot.timeStart, timeEnd: slot.timeEnd,
    driverIds, supportIds, contactIds, crewNames, acceptedClashKeys: clashKeys(clashes),
  }
  const next: Arrangement = { ...arr, offer: theOffer, lastReturn: null }
  if (!(await writeIf(ctx, { arrange_state: 'offered', arrangement: next }))) return stateChanged()

  await alertSalesSide(salesTarget(ctx.job),
    { type: 'arrange_offered', title: `Install date offered: ${titleOf(ctx.job)}`, body: `${slotLabel(slot)} · check with the client` },
    tplArrangeOffered({
      projectTitle: ctx.job.project_title, jobClient: ctx.job.client, jobUrl: jobUrl(ctx.job),
      schedulerName: ctx.viewer.name, slot: slotLabel(slot), crewNames,
    }))
  return ok('offered')
}

// ── Sends back (no fit / withdraw / client no) ──────────────────────────────

async function sendBack(
  ctx: ArrangeCtx, body: Record<string, unknown>,
  kind: 'no_fit' | 'withdrawn' | 'client_no', to: ArrangeState, needsText: boolean,
): Promise<ArrangeResult> {
  const arr = ctx.arrangement
  if (!arr) return stateChanged()
  const text = reasonText(body.text)
  if (needsText && !text) return fail(400, 'text_required')
  // The offer is kept: the scheduler's crew stays filled in for the next one.
  const next: Arrangement = { ...arr, lastReturn: returned(ctx, kind, text) }
  if (!(await writeIf(ctx, { arrange_state: to, arrangement: next }))) return stateChanged()

  const slot = arr.offer ? slotLabel(arr.offer) : null
  const msg = tplArrangeReturned({
    projectTitle: ctx.job.project_title, jobClient: ctx.job.client, jobUrl: jobUrl(ctx.job),
    kind, byName: ctx.viewer.name, text, slot,
  })
  const head = kind === 'client_no' ? 'Client said no' : kind === 'no_fit' ? "Couldn't fit" : 'Offer withdrawn'
  const bell = { type: 'arrange_returned' as const, title: `${head}: ${titleOf(ctx.job)}`, body: text ?? (slot ?? '') }
  if (kind === 'client_no') await alertSchedulers(ctx.job.id, bell, msg)
  else await alertSalesSide(salesTarget(ctx.job), bell, msg)
  return ok(to)
}

// ── Sales: not ready after all ──────────────────────────────────────────────

async function pullBack(ctx: ArrangeCtx): Promise<ArrangeResult> {
  if (!(await writeIf(ctx, arrangeClearPatch()))) return stateChanged()
  // Bell only — it simply leaves the scheduler's list; no need to buzz him.
  await alertSchedulers(ctx.job.id,
    { type: 'arrange_pulled_back', title: `Back to Ongoing: ${titleOf(ctx.job)}`, body: `Not ready yet — ${ctx.viewer.name}` },
    null)
  return ok(null)
}

// ── Sales: Client OK ────────────────────────────────────────────────────────

async function clientOk(ctx: ArrangeCtx): Promise<ArrangeResult> {
  const arr = ctx.arrangement
  const o = arr?.offer
  if (!arr || !o) return fail(409, 'offer_changed')
  const slot = slotOf(ctx.job)
  if (!offerMatchesJob(o, slot)) return fail(409, 'offer_changed')
  const missing = missingForStage('scheduled', ctx.job)
  if (missing.length) return fail(422, 'missing_fields', { fields: missing })

  const svc = createServiceClient()
  const clashes = await computeCrewClashes(svc, {
    jobId: ctx.job.id, date: o.date, dateEnd: o.dateEnd, timeStart: o.timeStart, timeEnd: o.timeEnd,
    punctuality: ctx.job.punctuality, driverIds: o.driverIds, supportIds: o.supportIds,
  })
  const fresh = newClashKeys(clashKeys(clashes), o.acceptedClashKeys)

  // Nic: "send it back to scheduler instead. sales isnt blocked anyways".
  if (fresh.length) {
    const freshIds = new Set(fresh.map(k => k.split(':')[1]))
    const names = [...new Set([...clashes.clashes, ...clashes.leaveClashes]
      .filter(c => freshIds.has(c.installerId)).map(c => c.installerName).filter(Boolean))]
    const next: Arrangement = { ...arr, lastReturn: returned(ctx, 'clash', names.join(', ') || null) }
    if (!(await writeIf(ctx, { arrange_state: 'clash', arrangement: next }))) return stateChanged()
    await alertSchedulers(ctx.job.id,
      { type: 'arrange_returned', title: `Client agreed, crew clashes: ${titleOf(ctx.job)}`, body: `${slotLabel(o)} · ${names.join(', ')}` },
      tplArrangeReturned({
        projectTitle: ctx.job.project_title, jobClient: ctx.job.client, jobUrl: jobUrl(ctx.job),
        kind: 'clash', byName: ctx.viewer.name, text: names.join(', ') || null, slot: slotLabel(o),
      }))
    return ok('clash', { outcome: 'clash', clashNames: names })
  }

  // 1. On the schedule — still conditional on nobody having moved it.
  const { data: moved, error: moveErr } = await svc.from('jobs')
    .update({ status: 'scheduled', ...arrangeClearPatch() } as never)
    .eq('id', ctx.job.id)
    .eq('status', 'awaiting_date') // raw status — see job-stage.ts
    .eq('arrange_state', 'offered')
    .select('id')
  if (moveErr || !(moved ?? []).length) {
    if (moveErr) console.error('[arrange] client OK move refused', ctx.job.id, moveErr)
    return stateChanged()
  }

  // 2. The offered crew becomes the confirmed crew — only once the job is on
  //    the schedule, never while an installer could see it Ongoing (0037).
  //    An offer with no crew leaves the crew (and sales' suggestions) alone.
  if (offerHasCrew(o)) {
    try {
      const { error: delErr } = await svc.from('job_assignees').delete().eq('job_id', ctx.job.id)
      if (delErr) throw delErr
      const rows = [
        ...o.driverIds.map(uid => ({ job_id: ctx.job.id, user_id: uid, is_suggestion: false, is_sub_installer: false })),
        ...o.supportIds.map(uid => ({ job_id: ctx.job.id, user_id: uid, is_suggestion: false, is_sub_installer: true })),
      ]
      if (rows.length) {
        const { data: written, error: insErr } = await svc.from('job_assignees').insert(rows as never).select('user_id')
        if (insErr || (written ?? []).length !== rows.length) throw insErr ?? new Error('crew rows missing')
      }
      // Outside contractors: the ones in the offer are confirmed, any others
      // (leftover suggestions) come off.
      const drop = svc.from('job_external_contacts').delete().eq('job_id', ctx.job.id)
      const { error: dropErr } = o.contactIds.length
        ? await drop.not('contact_id', 'in', `(${o.contactIds.join(',')})`)
        : await drop
      if (dropErr) throw dropErr
      if (o.contactIds.length) {
        const { error: confErr } = await svc.from('job_external_contacts')
          .update({ is_suggestion: false } as never).eq('job_id', ctx.job.id).in('contact_id', o.contactIds)
        if (confErr) throw confErr
      }
    } catch (err) {
      console.error('[arrange] client OK crew write failed, undoing', ctx.job.id, err)
      // Back to Ongoing with the offer still out. Formal crew must not stay on
      // an Ongoing job (0037), and scheduled_at goes back separately — the
      // 0038 trigger stamps it on the way into 'scheduled'.
      await svc.from('job_assignees').delete().eq('job_id', ctx.job.id).eq('is_suggestion', false)
      await svc.from('job_external_contacts').update({ is_suggestion: true } as never).eq('job_id', ctx.job.id)
      await svc.from('jobs').update({ status: 'awaiting_date', arrange_state: 'offered', arrangement: ctx.job.arrangement } as never).eq('id', ctx.job.id)
      await svc.from('jobs').update({ scheduled_at: ctx.job.scheduled_at } as never).eq('id', ctx.job.id)
      return fail(500, 'crew_not_saved')
    }
  }

  // 3. Tell people. Best-effort: the job is on the schedule either way.
  try {
    const notif = await getJobNotifData(ctx.job.id)
    if (notif) {
      const url = jobUrl(ctx.job)
      const people = [...o.driverIds, ...o.supportIds]
      const { data: users } = people.length
        ? await svc.from('users').select('id, name, telegram_chat_id').in('id', people).is('deleted_at', null) as
          { data: Array<{ id: string; name: string; telegram_chat_id: string | null }> | null }
        : { data: [] as Array<{ id: string; name: string; telegram_chat_id: string | null }> }
      const byId = new Map((users ?? []).map(u => [u.id, u]))
      const driverNames = o.driverIds.map(id => byId.get(id)?.name).filter((n): n is string => !!n)
      const common = {
        projectTitle: notif.project_title, jobClient: notif.client, pocName: notif.client_poc_name,
        pocPhone: notif.client_poc_phone, jobDate: notif.date, timeStart: notif.time_start,
        timeEnd: notif.time_end, location: notif.location, jobUrl: url,
      }
      await Promise.all([
        ...o.driverIds.map(id => byId.get(id)).filter(u => u?.telegram_chat_id)
          .map(u => sendTelegram(u!.telegram_chat_id!, tplJobAssigned(common))),
        ...o.supportIds.map(id => byId.get(id)).filter(u => u?.telegram_chat_id)
          .map(u => sendTelegram(u!.telegram_chat_id!, tplSubInstallerAssigned({ ...common, mainInstallers: driverNames }))),
      ])

      const title = `Client agreed: ${titleOf(ctx.job)}`
      if (clientOkSchedulerMessage(o) === 'arranged') {
        const awayNames = [...new Set(clashes.awayClashes.map(a => a.installerName).filter(Boolean))]
        await alertSchedulers(ctx.job.id,
          { type: 'arrange_client_ok', title, body: `On the schedule ${slotLabel(o)}` },
          tplArrangeClientOk({ projectTitle: notif.project_title, jobClient: notif.client, jobUrl: url, slot: slotLabel(o), crewNames: o.crewNames, awayNames }))
      } else {
        // No driver in the offer — the job still needs crew, so the schedulers
        // get the ordinary push message (Nic: crew is optional in an offer).
        await alertSchedulers(ctx.job.id,
          { type: 'arrange_client_ok', title, body: `On the schedule ${slotLabel(o)} — still needs a driver` },
          tplNewJobCreated({ ...common, salesName: ctx.viewer.name }))
      }
    }
  } catch (err) {
    console.error('[arrange] client OK notify failed', ctx.job.id, err)
  }
  return ok(null, { outcome: 'scheduled' })
}

export async function runArrangeAction(
  ctx: ArrangeCtx, action: ArrangeAction, body: Record<string, unknown>,
): Promise<ArrangeResult> {
  switch (action) {
    case 'ready':     return ready(ctx, body)
    case 'offer':     return offer(ctx, body)
    case 'send_back': return sendBack(ctx, body, 'no_fit', 'no_fit', true)
    case 'withdraw':  return sendBack(ctx, body, 'withdrawn', 'needs_date', false)
    case 'client_no': return sendBack(ctx, body, 'client_no', 'needs_date', true)
    case 'client_ok': return clientOk(ctx)
    case 'pull_back': return pullBack(ctx)
  }
}
