# Filling the old jobsheet from the app: setup guide

_For Nic. Written 2026-11-11. The same steps are in the app under Admin → Settings → Old jobsheet._

## What it does

The old **Greenqubes Jobs** Google Sheet fills itself with the app's scheduled jobs, so people still using the sheet see them during the switch-over.

- **Where the jobs go.** Each weekly tab ("9/11 to15/11" and so on) gets the app's jobs **below a yellow bar** reading "FROM THE APP · updated 11 Nov 2:05 PM · don't type below this line".
  - The time on the bar shows when it last filled, so old data is easy to spot.
- **Your typed rows are safe.** Rows typed above the bar are never touched, so keep typing jobs there as you do today.
  - When a bar is first added, it leaves 10 empty rows under your last typed row (or starts around row 45 on a new tab), so there's room to type.
  - Need more room? Insert rows **above** the bar.
- **Which weeks fill.** It refreshes **every hour**, for this week and up to 10 weeks ahead. Past weeks are left as they were, as a record.
- **Old tabs are safe.** It tells your tabs apart by their weekday, since your weeks start on a Monday, so last year's tabs are never touched.
- **New tabs.** It makes **next week's tab** by itself, named like yours, with your header rows copied from the newest weekly tab.
- **One way only.** Jobs typed into the sheet do **not** go into the app.
- **Text only.** Photos and files don't come across. Contact numbers do.

## Setting it up (once)

**Try it on a copy first:** in the sheet, File → Make a copy, and do these steps on the copy. Once you're happy, do the same on the real sheet.

1. **Make the link and copy the script.** In the app, go to Admin → Settings → Old jobsheet. Press **Make link**, then **Copy script**.
2. **Add the script.** In the Google Sheet, open **Extensions → Apps Script**.
   - If the editor only shows an empty `function myFunction() {}`, replace it with the script.
   - If there's other code there, leave it alone. Add a new file instead (**+ → Script**) and paste into that.
   - Press **Save**.
3. **Paste the link.** Back in the app, press **Copy link**. Reload the sheet. A **Greenqubes** menu appears at the top. Choose **Set app link** and paste.
4. **First run.** Choose **Greenqubes → Refresh now**. Google asks you to allow the script, so press **Continue** and choose your account.
   - If Google says "Google hasn't verified this app", that's normal for a script you added yourself. Press **Advanced**, then **Go to … (unsafe)**, then **Allow**.
   - The script only reads the app link and writes into this one sheet.
5. **Turn on the hourly refresh.** Choose **Greenqubes → Set up hourly refresh**. Done.

## Good to know

- **Don't type below the yellow bar, and don't delete it.** The next hourly refresh replaces everything under it. To add a job, insert a row above the bar.
- **Changing the link.** If someone leaves the company or the link gets shared by mistake:
  1. Press **Change link** in Admin → Settings. The old link stops working at once.
  2. In the sheet, choose **Greenqubes → Set app link** and paste the new one.
- **If a tab doesn't update,** it was left alone on purpose, and the bar's time shows how old its jobs are. That happens when:
  - the app didn't answer that hour;
  - the tab has two yellow bars (delete the extra one);
  - two tabs are named for the same week (rename one);
  - a merged cell crosses the bar (unmerge it).

  Fix it and it updates on the next refresh.
- **Who can see the link.** The link sits in the script's own settings, not in a cell, so people who only view the sheet can't see it.
