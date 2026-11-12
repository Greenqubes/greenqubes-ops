# Filling the jobsheet from the app: setup guide

_For Nic. Written 2026-11-11; full automation 2026-11-12. The same steps are in the app under Admin → Settings → Old jobsheet, and as a page: https://claude.ai/artifact/UCbTw5uY9eSrNPBBedNPXF_

## What it does

The **Greenqubes Jobs** Google Sheet is filled entirely by the app. Nobody types in it any more; share it with the team as **Viewer**.

- **Every hour, each week's tab is rewritten whole**, from row 1:
  - row 1: the week and when it last updated ("Greenqubes jobs · 9/11 to 15/11 · updated 12 Nov 9:00 PM …");
  - row 2: the column names (Date, Day, Production, Contact Person, Punctuality, Time, Jobs Description, Location / Sites, DO, PIC, Remarks, Job Time), pinned at the top;
  - then each day's date and that day's jobs.
  - Everything that was on the tab (typed rows, colours, merged cells) is replaced.
- **Which weeks.** This week and up to 10 weeks ahead.
  - This week's and next week's tabs are made by the app if they're missing.
  - A later week gets a tab once it has a job.
  - New tabs are named like yours ("16/11 to22/11") and placed in date order.
- **Past weeks are never touched.** Your old tabs stay as the record, including last year's tabs with the same dates (told apart by weekday).
- **Other tabs are never touched.** Only tabs named like a week ("d/m to d/m") are written.
- **One way only.** Jobs typed into the sheet do **not** go into the app, and they are wiped on the next refresh. Add jobs in the app.
- **Text only.** Photos and files don't come across. Contact numbers do.

## Before switching it on in the real sheet

- **Check this week's and next week's typed jobs are in the app.** The first refresh rewrites those tabs.
- **Nothing is lost for good:** File → Version history in Google Sheets can bring back any earlier version of the sheet.
- **Try it on a copy first** (File → Make a copy), then the real sheet.

## Setting it up (once)

1. **Make the link and copy the script.** In the app, go to Admin → Settings → Old jobsheet. Press **Make link** (skip this if you already have one), then **Copy script**.
2. **Add the script.** In the Google Sheet, open **Extensions → Apps Script**.
   - Updating from the older "yellow bar" version: select all of the old script and paste the new one over it.
   - If the editor only shows an empty `function myFunction() {}`, replace it with the script.
   - If there's other code there, leave it alone. Add a new file instead (**+ → Script**) and paste into that.
   - Press **Save**.
3. **Paste the link.** Back in the app, press **Copy link**. Reload the sheet. A **Greenqubes** menu appears at the top. Choose **Set app link** and paste. (Already done for the older version? The link is kept; skip this.)
4. **First run.** Choose **Greenqubes → Refresh now**. Google asks you to allow the script, so press **Continue** and choose your account.
   - If Google says "Google hasn't verified this app", that's normal for a script you added yourself. Press **Advanced**, then **Go to … (unsafe)**, then **Allow**.
   - The script only reads the app link and writes into this one sheet.
5. **Turn on the hourly refresh.** Choose **Greenqubes → Set up hourly refresh**. Done.
6. **Make it view-only.** Share the sheet with the team as **Viewer** (Share → change each person to Viewer).

## Good to know

- **Changing the link.** If someone leaves the company or the link gets shared by mistake:
  1. Press **Change link** in Admin → Settings. The old link stops working at once.
  2. In the sheet, choose **Greenqubes → Set app link** and paste the new one.
- **If a tab doesn't update,** it was left alone on purpose, and its title row shows when it last updated. That happens when:
  - the app didn't answer that hour (the next hour tries again);
  - two tabs are named for the same week (rename or delete one).
- **Who can see the link.** The link sits in the script's own settings, not in a cell, so people who only view the sheet can't see it.
- **Done testing on a copy?** Delete the copy, or it keeps filling itself every hour too.
