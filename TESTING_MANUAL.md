# AtomQuest Goal Tracking Portal - Complete Testing Manual

This manual outlines the end-to-end testing scenarios required to verify the functionality of the AtomQuest portal across all user roles (Admin, Manager, Employee).

## 1. Authentication & Authorization

- [ ] **TC-AUTH-01: Login Success** - Verify that a user can successfully log in with valid credentials (email and password).
- [ ] **TC-AUTH-02: Login Failure** - Verify that invalid credentials show an appropriate error message.
- [ ] **TC-AUTH-03: Role-Based Redirection** - Verify that an Admin is redirected to `/admin`, a Manager to `/manager`, and an Employee to `/employee` after login.
- [ ] **TC-AUTH-04: Protected Routes** - Verify that an employee cannot manually navigate to `/admin` or `/manager` routes, and is redirected appropriately.
- [ ] **TC-AUTH-05: Logout** - Verify that clicking logout clears the session/token and redirects to the login page.

## 2. Admin Workflows

### User Management
- [ ] **TC-ADM-01: View Users** - Verify that all users are listed correctly in the User Management tab.
- [x] **TC-ADM-02: Create User** - Verify that an Admin can create a new employee and manager, assigning correct roles and departments.
- [x] **TC-ADM-03: Edit User** - Verify that an Admin can update user details (e.g., change their manager or deactivate them).

### Cycle Management
- [x] **TC-ADM-04: View Cycles** - Verify that performance cycles are listed with their status (Active/Inactive) and phase.
- [x] **TC-ADM-05: Change Cycle Phase** - Verify that changing a cycle's phase (e.g., to `goal_setting` or `check_in`) restricts or enables relevant employee actions.

### Shared Goals
- [x] **TC-ADM-06: Share Goal** - Verify that an Admin can push a "Shared Goal" to specific employees. 
- [x] **TC-ADM-07: Shared Goal Lock** - Verify that when a shared goal is pushed, the target employee sees it in their Goal Sheet with the Title and Target locked.

## 3. Employee Workflows

### Goal Sheet Creation
- [x] **TC-EMP-01: Draft Goals** - Verify that an employee can create goals, assign thrust areas, set UoM types, target values, and click "Save Draft" successfully.
- [x] **TC-EMP-02: Goal Constraints** - Verify that the system enforces a maximum of 8 goals.
- [x] **TC-EMP-03: Weightage Validation** - Verify that the system enforces a minimum of 10% weightage per goal.
- [x] **TC-EMP-04: 100% Weightage Rule** - Verify that the "Submit for Approval" button throws an error or is disabled if the total weightage does not equal exactly 100%.
- [x] **TC-EMP-05: Submit Goals** - Verify that clicking "Submit for Approval" successfully locks the goals and updates the sheet status to `submitted`.
- [x] **TC-EMP-06: Read-Only Post Submit** - Verify that an employee cannot edit their goals after submission.

### Logging Achievements (Check-ins)
- [x] **TC-EMP-07: Prerequisite Check** - Verify that the "Log Achievements" page prompts the user that goals must be `approved` before logging achievements.
- [x] **TC-EMP-08: Log Achievement Data** - With an approved sheet, verify that an employee can enter actual values/dates for a specific quarter and click "Save Updates".
- [x] **TC-EMP-09: Score Calculation** - Verify that progress scores are dynamically calculated based on the selected UoM type (e.g., higher is better, lower is better, timeline, zero-based) and displayed accurately.
- [x] **TC-EMP-10: Window Closed Constraint** - Verify that employees cannot log achievements if the current cycle's check-in window is closed or phase is incorrect.

## 4. Manager Workflows

### Team Dashboard & Goal Review
- [x] **TC-MGR-01: Dashboard Stats** - Verify that the Manager Dashboard accurately shows the number of Team Members, Pending Approvals, and Approved Goals.
- [x] **TC-MGR-02: Review Pending Sheet** - Verify that a manager can view a submitted goal sheet from an employee.
- [x] **TC-MGR-03: Approve Goals** - Verify that clicking "Approve & Lock Goals" successfully approves the sheet, locking it for the employee, and updates the dashboard stats.
- [x] **TC-MGR-04: Manager Inline Edits** - Verify that a manager can tweak target values or weightage before hitting "Approve".
- [x] **TC-MGR-05: Return for Rework** - Verify that a manager can return a sheet, requiring a feedback comment.
- [x] **TC-MGR-06: Employee Revision** - Verify that an employee receives the returned sheet, can read the manager's comment, edit their goals, and resubmit.

### Quarterly Check-ins
- [x] **TC-MGR-07: View Employee Progress** - Verify that the manager can view the achievements logged by their team members in the Check-ins tab.
- [x] **TC-MGR-08: Manager Feedback** - Verify that the manager can add and save a "Check-in Comment" for a specific employee and quarter.

## 5. End-to-End System Integrity
- [x] **TC-SYS-01: API State Sync** - Verify that saving drafts (GoalSheet) and syncing progress (Achievements) updates the frontend state immediately without requiring a page refresh.
- [x] **TC-SYS-02: Database Constraints** - Verify that duplicate achievements for the same quarter are treated as updates (UPSERT) rather than creating duplicate rows.
- [x] **TC-SYS-03: Notifications** - Verify that employees and managers receive notifications for actions like submission, approval, return, and shared goals.
