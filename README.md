# Ram Raj Online Exam Portal

Online exam (CBT) portal for Ram Raj IIT | Medical | MHT-CET. Built with Next.js and MongoDB.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`.
3. Create the first admin login. The temporary password is printed once:

   ```bash
   node --env-file=.env.local scripts/create-admin.mjs <username> "<full name>"
   ```

4. Start the app: `npm run dev`, then open http://localhost:3000.

## Accounts

- **Students** log in with their student ID. They have no password until staff give them one: use **Issue Passwords** on the Students page for a whole batch (downloads a CSV), or the key icon for one student. Temporary passwords must be changed at first login.
- **Teachers and admins** are created with `scripts/create-admin.mjs` (add `teacher` as the last argument for a teacher). Only admins can delete students, subjects, chapters and exams, issue passwords in bulk, or remove a result to allow a retake.

## How exams work

1. Staff create an exam, which starts as a **draft** that students cannot see.
2. Staff add questions, set the schedule and marking, then **publish**. Publishing is refused if a question can't be marked.
3. A student gets one attempt. The deadline is set by the server, answers autosave, and refreshing or reconnecting resumes the attempt.
4. The server scores the attempt on submit, at the deadline, or, for an abandoned attempt, the next time results are read. Correct answers are never sent to students' browsers.

Once any student has started, an exam's questions and marking are locked and it can't be deleted.

## Scripts

Run these with `node --env-file=.env.local scripts/<name>`.

| Script | Purpose |
| --- | --- |
| `create-admin.mjs` | Create a staff login or reset its password |
| `migrate-dates.mjs` | Add real dates to older records (preview by default, `--apply` to write) |
| `test-connection.mjs` | Check the database connection |
| `seed-atlas.mjs`, `parse-and-seed-questions.mjs` | **Delete existing data** and load demo data. Refuse to run without `--confirm-wipe` |

## Tests

`npm test` runs the scoring unit tests.
