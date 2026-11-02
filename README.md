# Ram Raj Online Exam Portal

An online exam (CBT) portal for Ram Raj IIT | Medical | MHT-CET. Students sit timed exams in the browser, and staff manage questions, schedule exams and review detailed results.

Built with Next.js 16, React 19, MongoDB and Tailwind CSS.

## Features

**For students**
- Log in with a student ID and see only the exams assigned to their batch
- NTA-style exam screen with a question palette and mark for review
- Answers autosave, and refreshing or reconnecting resumes the exam
- Results with score, rank and a breakdown by subject

**For staff**
- Manage students, batches, subjects, chapters and the question bank
- Create exams as drafts, set the schedule and marking, then publish
- Marking schemes: each question's own marks, +4/−1, or custom rules per subject
- Results with percentile, accuracy, time taken and Excel export
- A details page for each student: score card, section and subject charts, time analysis and question-by-question solutions

**Exam integrity**
- The server sets the deadline and works out every score
- Correct answers are never sent to students' browsers
- One attempt per student per exam
- Leaving the exam or full screen hides the paper and gives a warning, and the 3rd warning submits the exam
- Questions and marking lock once any student has started

## Getting started

You need Node.js 22 or later and a MongoDB database.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`.

3. Create the first admin login. The temporary password is printed once:

   ```bash
   node --env-file=.env.local scripts/create-admin.mjs <username> "<full name>"
   ```

4. Start the app, then open http://localhost:3000:

   ```bash
   npm run dev
   ```

## Accounts

- **Students** log in with their student ID. They have no password until staff give them one: use **Issue Passwords** on the Students page for a whole batch (downloads a CSV), or the key icon for one student. Temporary passwords must be changed at first login.
- **Teachers and admins** are created with `scripts/create-admin.mjs` (add `teacher` as the last argument for a teacher). Only admins can delete students, subjects, chapters and exams, issue passwords in bulk, or remove a result to allow a retake.

## Bulk import

Both importers show a preview first, list what's wrong with each row, and skip anything already on the portal. Download the sample files from each page.

- **Questions** (Questions → Bulk Import): a Word `.docx` file of up to 4 MB, with one table per question, in the format of [BulkImportSample.docx](public/samples/BulkImportSample.docx). Word equations and pictures are kept. The supported types are MCQ with one correct option, `true_false` and `numeric` (one value or a range like `1.2-3.4`). Questions go into the question bank, and can also be added to a paper as they're imported.
- **Students** (Students → Bulk Import): a `.csv` file with the first line `name,email,phone,dob`, as in [sample-students.csv](public/samples/sample-students.csv). Name and a 10-digit phone are required. The batch is chosen on the page, and student IDs are created automatically. Students need a password before they can log in.

## How exams work

1. Staff create an exam, which starts as a **draft** that students cannot see.
2. Staff add questions, set the schedule and marking, then **publish**. Publishing is refused if a question can't be marked.
3. A student gets one attempt. Answers autosave, and the timer keeps running if they close the browser.
4. The server scores the attempt on submit, at the deadline, on the 3rd warning, or, for an abandoned attempt, the next time results are read.

### Sections

Questions go into a section named after their subject automatically, or into whichever section is open in the exam editor, and each question can be moved to another section. Students see the sections as tabs and sit the paper section by section, with question numbers running through the whole exam. Sections lock once any student has started.

### Warnings

Switching tabs, moving to another window or exiting full screen hides the paper and gives the student a warning. The warning button also returns them to full screen, because browsers only allow that after a click or key press. Each warning is recorded and shown to staff on the student's details page.

These checks run in the browser, so they discourage cheating but can't prevent it entirely, and something like a notification can occasionally trigger a warning. Staff can review each warning, and an admin can allow a retake.

### Camera monitoring

Staff can turn this on per exam in the exam's settings. Students then pass a camera check before starting, and during the exam the portal flags:

- no face in the camera for 5 seconds
- more than one face for 3 seconds
- a possible mobile phone that is clearly visible
- the camera being turned off, which also hides the paper

After a full minute with no face, a large popup also appears. It doesn't count toward the 3 warnings.

The video is analysed on the student's device with [MediaPipe](https://ai.google.dev/edge/mediapipe) and isn't uploaded. Each flag saves one small photo for staff, shown in the **Camera** tab of the student's result, and photos are deleted automatically after 60 days. Flags never submit an exam, because detection can be wrong. A phone kept out of the camera's view can't be detected.

Browsers only allow camera access on HTTPS or `localhost`. Filming students, especially minors, may need parental consent, so please confirm this before turning it on. A student whose camera doesn't work can be exempted in the exam's settings.

## Scripts

Run these with `node --env-file=.env.local scripts/<name>`.

| Script | Purpose |
| --- | --- |
| `create-admin.mjs` | Create a staff login or reset its password |
| `migrate-dates.mjs` | Add real dates to older records (preview by default, `--apply` to write) |
| `test-connection.mjs` | Check the database connection |
| `seed-atlas.mjs` | **Deletes existing data** and loads demo data. Refuses to run without `--confirm-wipe` |

## Tests

```bash
npm test
```

This runs the unit tests for scoring and result analysis.

## Security

- Never commit `.env.local`, database backups or exported password files. They are listed in `.gitignore`.
- Real exam questions and answers must stay out of this public repository. Load them into the database privately.
