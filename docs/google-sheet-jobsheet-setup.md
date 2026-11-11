# Filling the old jobsheet from the app: setup guide

_For Nic. Written 2026-11-11. The same steps are in the app under Admin → Settings → Old jobsheet._

## What it does

The old **Greenqubes Jobs** Google Sheet fills itself with the app's scheduled jobs, so people still using the sheet see them during the switch-over.

- Each weekly tab ("9/11 to15/11" and so on) gets the app's jobs **below a yellow bar** that reads "FROM THE APP · fills itself every hour · don't type below this line".
- **Rows typed above the bar are never touched.** Keep typing jobs there as you do today.
- It refreshes **every hour**, for this week and any later weeks. Past weeks are left as they were, as a record.
- It makes **next week's tab** by itself, named like yours, with your header rows copied from the newest weekly tab.
- It's one way only. Jobs typed into the sheet do **not** go into the app.
- Photos and files don't come across, only text. Contact numbers do.

## Setting it up (once)

**Try it on a copy first:** in the sheet, File → Make a copy, and do these steps on the copy. Once you're happy, do the same on the real sheet.

1. **Make the link.** In the app, go to Admin → Settings → Old jobsheet and press **Make link**, then **Copy**.
2. **Add the script.**
   1. In the Google Sheet, open **Extensions → Apps Script**.
   2. Delete what's there and paste in the whole script. It lives at `scripts/google-sheet/jobsheet-sync.gs` in the greenqubes-ops repo on GitHub, and the Admin card links to it.
   3. Press **Save**.
3. **Paste the link.** Reload the sheet. A **Greenqubes** menu appears at the top. Choose **Set app link** and paste the link.
4. **First run.** Choose **Greenqubes → Refresh now**. Google asks you to allow the script, so press **Continue** and choose your account.
   - If Google says "Google hasn't verified this app", that's normal for a script you added yourself. Press **Advanced**, then **Go to … (unsafe)**, then **Allow**. The script only reads the app link and writes into this one sheet.
5. **Turn on the hourly refresh.** Choose **Greenqubes → Set up hourly refresh**. Done.

## Good to know

- **Don't type below the yellow bar.** The next hourly refresh replaces everything under it.
- **Changing the link.** If someone leaves the company or the link gets shared by mistake:
  1. Press **Change link** in Admin → Settings. The old link stops working at once.
  2. In the sheet, choose **Greenqubes → Set app link** and paste the new one.
- **If a tab doesn't update,** it was left alone on purpose. That happens when the app didn't answer that hour, or when the tab has two yellow bars. Delete the extra bar and it fixes itself on the next refresh.
- **Who can see the link.** The link sits in the script's own settings, not in a cell, so people who only view the sheet can't see it.
