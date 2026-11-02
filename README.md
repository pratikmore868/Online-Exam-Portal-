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

## How exams work

1. Staff create an exam, which starts as a **draft** that students cannot see.
2. Staff add questions, set the schedule and marking, then **publish**. Publishing is refused if a question can't be marked.
3. A student gets one attempt. Answers autosave, and the timer keeps running if they close the browser.
4. The server scores the attempt on submit, at the deadline, on the 3rd warning, or, for an abandoned attempt, the next time results are read.

### Warnings

Switching tabs, moving to another window or exiting full screen hides the paper and gives the student a warning. The warning button also returns them to full screen, because browsers only allow that after a click or key press. Each warning is recorded and shown to staff on the student's details page.

These checks run in the browser, so they discourage cheating but can't prevent it entirely, and something like a notification can occasionally trigger a warning. Staff can review each warning, and an admin can allow a retake.

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
