# Benjamin Webster: Technical Writing Portfolio

A multi-page portfolio site for ENGL 2210 in UNM cherry and silver, ready for GitHub Pages.

## What's here

| File | What it is |
|------|------------|
| `index.html` | Home page: title and Meteor-M2 image, About me (headshot, bio, ECE / CS / COSMIAC logos, rappelling photo), and At COSMIAC (team photo, testbed, two STK simulation videos) |
| `tracker.html` | **Satellite tracker** in the menu bar: the live map, satellite details, next Meteor-M2 pass, and your antenna photo |
| `outcomes-memo.html` … `recommendations-report.html` | One page per assignment, each showing the document inline. The **Documents** menu in the red menu bar lists all nine on hover, so every document is one click from any page |
| `assets/` | Shared styles (`style.css`), the document viewer (`site.js`), and the tracker (`tracker.js`) |
| `documents/` | Your PDFs: six of the nine are already here (see the table below) |
| `videos/` | The two STK simulation videos for the At COSMIAC section on the home page, compressed for the web, with poster images |
| `images/` | All your photos (included, resized for the web with location and camera data removed), plus the three logos you add |
| `data/` | Satellite orbit data, filled in automatically by the GitHub Action |
| `.github/workflows/update-tle.yml` | GitHub Action that refreshes the orbit data twice a day |

## 1. Add your files

**Photos (already included).** These are in `images/`. To swap one, replace the file and keep the same name.

| Photo | File |
|-------|------|
| Las Conchas (background behind every page) | `las-conchas.jpg` |
| Headshot | `headshot.jpg` |
| COSMIAC team | `cosmiac-team.jpg` |
| Satellite testbed | `satellite-testbed.jpg` |
| Rappelling (bottom of About me) | `climbing-rappel.jpg` |
| Meteor-M2 image (title section) | `meteor-australia-hero.jpg`, full size `meteor-australia.jpg` |

**Antenna photo (still needed).** Save the photo of your QFH antenna as `images/antenna.jpg`. It appears on the Satellite tracker page, beside a live line that shows the next Meteor-M2 pass over Albuquerque. Until the file is there, the photo spot hides itself.

Captions are in `index.html`, next to each `<figcaption>`.

**Logos (already included).** `logo-unm-ece.png`, `logo-unm-cs.png`, and `logo-cosmiac.png` are in `images/`, trimmed of extra white space. The COSMIAC one is the orange wordmark from the image you sent. They show as plain images, not links.

**Documents.** Six are already converted to PDF and in `documents/`. The Word files were converted with LibreOffice; if any page looks different from Word, open the original in Word, choose File > Save As > PDF, and replace the file with the same name. GitHub Pages is case-sensitive.

| # | Page | File name | Status |
|---|------|-----------|--------|
| 1 | `outcomes-memo.html` | `Webster_Portfolio_Outcomes_Memo.pdf` | **Still needed** |
| 2 | `club-memo.html` | `Webster_UNM_Club_Memo.pdf` | Included |
| 3 | `club-complaint-letter.html` | `Webster_UNM_Club_Complaint_Letter.pdf` | Included |
| 4 | `club-flyer.html` | `Webster_UNM_Club_Flyer.pdf` | Included |
| 5 | `postmortem-report.html` | `Webster_Postmortem_PowerPoint_Report.pdf` | Included |
| 6 | `emergency-instructions.html` | `Webster_Emergency_Instructions.pdf` | Included |
| 7 | `written-instructions.html` | `Webster_Written_Instructions_MWA1.pdf` | Included |
| 8 | `video-instructions.html` | YouTube video `lWY4owxDl14` | Included |
| 9 | `recommendations-report.html` | `Webster_Recommendations_Report.pdf` | **Still needed** |

If a file is missing, its page says "Missing" and hides the open and download buttons.

**Video.** Document 8 plays your YouTube video (`youtu.be/lWY4owxDl14`). Make sure it's set to Public or Unlisted, not Private, or it won't play on the site. To swap it, change `data-youtube-id` in `video-instructions.html`.

**Descriptions.** Each assignment page has a short description, marked with an `<!-- Edit this description -->` comment. Documents 2 through 7 are now described from their actual content. Documents 1, 8, and 9 still have general descriptions; update them if you like.

`Webster_Resume.pdf` is linked in the footer of every page. It includes your phone number; delete the file and the footer link if you don't want that public.

**Meteor-M2 image.** `images/meteor-australia.jpg` (full, with the dropout stripe trimmed off) and `images/meteor-australia-hero.jpg` (the cropped version on the home page) are already included. Clicking the image opens the full version. If someone else received it, add a credit to its caption in `index.html`.

## 2. Publish on GitHub Pages

1. Create a new **public** repository on GitHub (for example `portfolio`).
2. Click **Add file → Upload files** and drag in everything from this folder. Commit.
   - Your computer may hide the `.github` folder because its name starts with a dot. If it didn't upload, click **Add file → Create new file**, name it `.github/workflows/update-tle.yml`, paste in the contents of that file, and commit.
3. Go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and click **Save**.
4. Your site will be live at `https://YOUR-USERNAME.github.io/portfolio/` within a couple of minutes. That's the link you submit in Canvas.

**Updating an existing site:** upload *every* file again, including the `assets` folder, so the pages and the stylesheet match. If the site still looks like an old version, press Ctrl+Shift+R (Cmd+Shift+R on a Mac) to skip the browser's cache. The pages load `style.css?v=10`; if you ever edit `style.css` or a script yourself, change that number in every page so browsers fetch the new copy.

## 3. Turn on the satellite tracker's data feed

The tracker calculates positions in the browser from each satellite's two-line element set (TLE). The GitHub Action downloads fresh TLEs from CelesTrak twice a day and saves them to `data/tle.txt`. That way the site doesn't depend on CelesTrak accepting requests straight from visitors' browsers.

1. Open the **Actions** tab of your repository. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
2. Click **Update satellite orbit data**, then **Run workflow**. In about 30 seconds it adds `data/tle.txt` and `data/land-110m.json` (the world map outline).
3. Open the Satellite tracker page. The status line under the map says where the data came from and when it was published.

If the Action isn't running, the tracker tries CelesTrak and two backup sources directly from the browser. If those fail too, it says so instead of showing wrong positions.

GitHub pauses scheduled Actions on repositories with no activity for 60 days. If the tracker data goes stale after the semester, re-run the workflow from the Actions tab.

**To track different satellites,** edit the `SATS` list near the top of the UI section in `assets/tracker.js` and the list of IDs in the workflow file. Use NORAD catalog numbers.

## 4. Check before you submit (due Fri, Dec 4, 11:59 pm)

- [ ] COSMIAC is OK with the team photo and the testbed photo being public, and your teammates are fine with being on the site.
- [ ] All nine assignment pages show their documents, including the video.
- [ ] The tracker shows satellites and a "next pass" time.
- [ ] Every description names your real content.
- [ ] The Outcomes Memo is also uploaded separately in Canvas.
- [ ] Your instructor has confirmed that GitHub Pages counts as an approved platform. The prompt lists Wix, Weebly, WebAdore, and Portfoliobox as examples and bans Google properties; GitHub isn't mentioned either way.
