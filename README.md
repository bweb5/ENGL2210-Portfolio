# Benjamin Webster: Technical Writing Portfolio

A multi-page portfolio site for ENGL 2210 in UNM cherry and silver, ready for GitHub Pages.

## What's here

| File | What it is |
|------|------------|
| `index.html` | Home page about you: title, Meteor-M2 satellite image, headshot, bio, ECE / CS / COSMIAC logos, team photo, live satellite tracker, and a button to the documents |
| `outcomes-memo.html` … `recommendations-report.html` | One page per assignment, each showing the document inline. The **Documents** menu in the red menu bar lists all nine on hover, so every document is one click from any page |
| `assets/` | Shared styles (`style.css`), the document viewer (`site.js`), and the tracker (`tracker.js`) |
| `documents/` | Your PDFs (and the video, if you don't use YouTube) |
| `images/` | Meteor-M2 image (included), plus your headshot, team photo, and logos |
| `data/` | Satellite orbit data, filled in automatically by the GitHub Action |
| `.github/workflows/update-tle.yml` | GitHub Action that refreshes the orbit data twice a day |

## 1. Add your files

**Headshot.** Save a professional photo as `images/headshot.jpg` (portrait orientation, about 800 × 1000 px). Until then the photo spot shows "BW".

**Logos.** Save the three logos in `images/` with these names. PNG with a transparent or white background works best; any width is fine.

| Logo | File name | Links to |
|------|-----------|----------|
| UNM Electrical & Computer Engineering | `logo-unm-ece.png` | ece.unm.edu |
| UNM Computer Science | `logo-unm-cs.png` | cs.unm.edu |
| COSMIAC | `logo-cosmiac.png` | cosmiac.unm.edu |

Until a logo file is there, its tile shows the name in text, so the page still looks finished. UNM's logos are registered marks with usage rules (see brand.unm.edu), and COSMIAC's is your employer's, so it's worth a quick check with the department and COSMIAC before publishing them.

**Team photo.** Save your COSMIAC team picture as `images/cosmiac-team.jpg` (landscape, around 1600 px wide). It appears under your bio with the caption "With my team at COSMIAC." To change the caption, edit the `<figcaption>` line in `index.html`. If the file is missing, the photo section hides itself.

**Documents.** Export every document to PDF, including the PowerPoint and the flyer, so it shows inside the page. Save each one in `documents/` with exactly these names. GitHub Pages is case-sensitive.

| # | Page | File name |
|---|------|-----------|
| 1 | `outcomes-memo.html` | `Webster_Portfolio_Outcomes_Memo.pdf` |
| 2 | `club-memo.html` | `Webster_UNM_Club_Memo.pdf` |
| 3 | `club-complaint-letter.html` | `Webster_UNM_Club_Complaint_Letter.pdf` |
| 4 | `club-flyer.html` | `Webster_UNM_Club_Flyer.pdf` |
| 5 | `postmortem-report.html` | `Webster_Postmortem_PowerPoint_Report.pdf` |
| 6 | `emergency-instructions.html` | `Webster_Emergency_Instructions.pdf` |
| 7 | `written-instructions.html` | `Webster_Written_Instructions_MWA1.pdf` |
| 8 | `video-instructions.html` | YouTube, or `Webster_Video_Instructions_MWA1.mp4` |
| 9 | `recommendations-report.html` | `Webster_Recommendations_Report.pdf` |

If a file is missing, its page says "This document hasn't been uploaded yet" instead of breaking.

**Video.** Upload the video to YouTube as **Unlisted** and copy the ID from the link (in `youtube.com/watch?v=AbC123xYz`, the ID is `AbC123xYz`). In `video-instructions.html`, find `data-youtube-id=""` and paste the ID between the quotes. To host the file yourself instead, leave the ID empty and add the MP4 to `documents/`. GitHub rejects files over 100 MB.

**Descriptions.** Each assignment page has a short description, marked with an `<!-- Edit this description -->` comment. The home page has a one-line version in each tile. They're written at the genre level ("a UNM student organization"). Edit both to name your actual club, task, and topic.

`Webster_Resume.pdf` is linked in the footer of every page. It includes your phone number; delete the file and the footer link if you don't want that public.

**Meteor-M2 image.** `images/meteor-australia.jpg` (full, with the dropout stripe trimmed off) and `images/meteor-australia-hero.jpg` (the cropped version on the home page) are already included. Clicking the image opens the full version. If someone else received it, add a credit to its caption in `index.html`.

## 2. Publish on GitHub Pages

1. Create a new **public** repository on GitHub (for example `portfolio`).
2. Click **Add file → Upload files** and drag in everything from this folder. Commit.
   - Your computer may hide the `.github` folder because its name starts with a dot. If it didn't upload, click **Add file → Create new file**, name it `.github/workflows/update-tle.yml`, paste in the contents of that file, and commit.
3. Go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and click **Save**.
4. Your site will be live at `https://YOUR-USERNAME.github.io/portfolio/` within a couple of minutes. That's the link you submit in Canvas.

**Updating an existing site:** upload *every* file again, including the `assets` folder, so the pages and the stylesheet match. If the site still looks like an old version, press Ctrl+Shift+R (Cmd+Shift+R on a Mac) to skip the browser's cache. The pages load `style.css?v=5`; if you ever edit `style.css` or a script yourself, change that number in every page so browsers fetch the new copy.

## 3. Turn on the satellite tracker's data feed

The tracker calculates positions in the browser from each satellite's two-line element set (TLE). The GitHub Action downloads fresh TLEs from CelesTrak twice a day and saves them to `data/tle.txt`. That way the site doesn't depend on CelesTrak accepting requests straight from visitors' browsers.

1. Open the **Actions** tab of your repository. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
2. Click **Update satellite orbit data**, then **Run workflow**. In about 30 seconds it adds `data/tle.txt` and `data/land-110m.json` (the world map outline).
3. Reload your site. The status line under the map says where the data came from and when it was published.

If the Action isn't running, the tracker tries CelesTrak and two backup sources directly from the browser. If those fail too, it says so instead of showing wrong positions.

GitHub pauses scheduled Actions on repositories with no activity for 60 days. If the tracker data goes stale after the semester, re-run the workflow from the Actions tab.

**To track different satellites,** edit the `SATS` list near the top of the UI section in `assets/tracker.js` and the list of IDs in the workflow file. Use NORAD catalog numbers.

## 4. Check before you submit (due Fri, Dec 4, 11:59 pm)

- [ ] Your headshot shows (not "BW"), and so does the team photo.
- [ ] The three logos show (or you've decided to keep the text tiles).
- [ ] All nine assignment pages show their documents, including the video.
- [ ] The tracker shows satellites and a "next pass" time.
- [ ] Every description names your real content.
- [ ] The Outcomes Memo is also uploaded separately in Canvas.
- [ ] Your instructor has confirmed that GitHub Pages counts as an approved platform. The prompt lists Wix, Weebly, WebAdore, and Portfoliobox as examples and bans Google properties; GitHub isn't mentioned either way.
