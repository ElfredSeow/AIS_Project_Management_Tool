\# AIS Project Tracker



\## Overview



A project tracking system designed for engineering teams managing hardware and software initiatives. The system combats project stagnancy through visual alerting, enforces accountability via automatic status logging, and provides leadership with real-time visibility into project health and man-hour savings.



\## Contributors and Roles



Each project requires at least one contributor. Contributors are assigned one of the following roles:



| Role | Description |

|------|-------------|

| \*\*Project Manager\*\* | Oversees project execution, coordinates team, manages timeline and deliverables |

| \*\*Developer\*\* | Implements technical solutions, writes code, builds hardware/software components |

| \*\*End User\*\* | Provides requirements and feedback, validates solutions meet business needs |

| \*\*Ops Manager\*\* | Manages operational aspects, deployment, and ongoing maintenance |

| \*\*Product Owner\*\* | Defines product vision, prioritizes features, represents stakeholder interests |



Multiple contributors can be assigned to a single project, each with their own role.



\## Key Scenarios



1\. \*\*Daily Standup Review\*\*: Manager opens dashboard, filters to "In Progress" projects, spots amber-highlighted stagnant items requiring follow-up

2\. \*\*Project Creation\*\*: Owner creates new project, defines problem statement, sets milestones with target dates, assigns team members

3\. \*\*Status Update\*\*: Owner updates project status; system automatically logs change with timestamp

4\. \*\*Escalation Discovery\*\*: Manager filters to stagnant projects, drills into detail view to see full status history and last activity

5\. \*\*Completion Tracking\*\*: Project marked complete; system records final completion date and calculates total man-hours saved



\## Design Direction



\*\*Aesthetic\*\*: Modern Kanban dashboard with clean card-based layouts. Monospace typography accents for technical feel, smooth drag-and-drop animations, and a light/dark theme toggle.



\*\*Color System\*\*:

\- Violet for Ideation status

\- Amber for In Progress status

\- Emerald for Completed status

\- Slate for De-Prioritised status

\- Orange accent for Hardware projects

\- Cyan accent for Software projects



\*\*Typography\*\*: Monospace fonts for headers, dates, and KPI labels. Clean sans-serif for body text and descriptions.



\*\*Visual Identity\*\*: Rounded cards with subtle borders, status-colored dots, KPI summary cards at top, four-column Kanban layout for status-based project organization.



\### Kanban Board Structure



The dashboard uses a four-column Kanban layout where projects are grouped by status:



| Column | Status Key | Color Dot |

|--------|------------|-----------|

| Ideation | StatusKey0 | Violet |

| In Progress | StatusKey1 | Amber |

| Completed | StatusKey2 | Emerald |

| De-Prioritised | StatusKey3 | Slate |



Each column displays:

\- Column header with status name, colored dot indicator, and project count badge

\- "+" button to create a new project directly in that status

\- Expand/collapse all cards button

\- Scrollable card container with drag-and-drop support

\- Empty state placeholder when no projects exist in that column



\### Drag and Drop Functionality



\*\*Dragging a Card:\*\*

\- Cards are draggable via the grip handle icon (visible on hover)

\- While dragging, the cursor changes to "grabbing"

\- Cards lift slightly with enhanced shadow on hover



\*\*Drop Zones:\*\*

\- Each column acts as a drop zone

\- When dragging over a column, it highlights with:

&#x20; - Primary color background tint (`bg-primary/10`)

&#x20; - Dashed ring border (`ring-2 ring-primary/50 ring-dashed`)

\- Empty columns show "Drop here" text when a card is dragged over them



\*\*Status Update on Drop:\*\*

\- Dropping a card in a different column automatically updates the project's status

\- The status is set to the column's `targetStatusKey`

\- Success toast: "Moved to \[Column Name]"

\- Error toast if update fails: "Failed to update project status"

\- Cards dropped in their current column are ignored (no update triggered)



\## Project Card View Buttons



Each Kanban card includes action buttons that appear on hover:



| Button | Icon | Position | Action |

|--------|------|----------|--------|

| \*\*Edit\*\* | Pencil | Top-right, first | Opens the edit dialog to modify the project |

| \*\*Expand\*\* | Chevron Right | Top-right, second | Expands/collapses the card to show problem statement and proposed solutions |

| \*\*View\*\* | Eye | Footer, right side | Opens the full project detail modal |



Button visibility:

\- Edit and Expand buttons appear on card hover (opacity transition)

\- View button is always visible in the card footer

\- Chevron rotates 90° when card is expanded



\## Project Detail Modal



The full-screen modal displays comprehensive project information when clicking the "View" button on a card.



\### Modal Layout Structure



```

┌─────────────────────────────────────────────────────────────┐

│  Header (sticky)                                       \[X] │

│  ┌──────────────────────────────────────────────────────┐  │

│  │ \[Type Badge] \[Days Remaining Badge]                  │  │

│  │ Project Name                                         │  │

│  └──────────────────────────────────────────────────────┘  │

├─────────────────────────────────────────────────────────────┤

│  Scrollable Content Area                                   │

│  ┌──────────────────────────────────────────────────────┐  │

│  │ Progress Bar (Overall Progress %)                    │  │

│  └──────────────────────────────────────────────────────┘  │

│                                                             │

│  ┌──────────────────────────────────────────────────────┐  │

│  │ Project Team (grouped by role)                       │  │

│  │ \[PM]        \[Developer]      \[End User]              │  │

│  │ • Name      • Name           • Name                  │  │

│  └──────────────────────────────────────────────────────┘  │

│                                                             │

│  ┌─────────────────────┐  ┌─────────────────────┐          │

│  │ Problem Statement   │  │ Proposed Solution   │          │

│  │ (rose gradient)     │  │ (emerald gradient)  │          │

│  └─────────────────────┘  └─────────────────────┘          │

│                                                             │

│  ┌─────────────────────┐  ┌─────────────────────┐          │

│  │ Expected Benefits   │  │ Est. Man-Hours      │          │

│  │ (blue gradient)     │  │ (amber gradient)    │          │

│  └─────────────────────┘  └─────────────────────┘          │

│                                                             │

│  ┌──────────────────────────────────────────────────────┐  │

│  │ Timeline                                              │  │

│  │ \[Project Start]          \[Target Completion]          │  │

│  └──────────────────────────────────────────────────────┘  │

│                                                             │

│  ┌──────────────────────────────────────────────────────┐  │

│  │ Project Milestones                    \[X/Y completed] │  │

│  │ ○──┐                                                  │  │

│  │    │ Milestone 1                        \[EDD Badge]   │  │

│  │ ●──┘ Description...                                   │  │

│  │    │                                                  │  │

│  │ ○    Milestone 2                        \[EDD Badge]   │  │

│  │      Description...                                   │  │

│  └──────────────────────────────────────────────────────┘  │

│                                                             │

│  ┌──────────────────────────────────────────────────────┐  │

│  │ Media URLs                                            │  │

│  │ \[Image\_1] \[Image\_2] \[Video\_1] \[Others\_1]              │  │

│  └──────────────────────────────────────────────────────┘  │

└─────────────────────────────────────────────────────────────┘

```



\### Modal Sections



| Section | Content | Visual Style |

|---------|---------|--------------|

| \*\*Header\*\* | Type badge, days remaining badge, project name, close button | Sticky, gradient background from card color |

| \*\*Progress Bar\*\* | Overall milestone completion percentage | Animated fill, color changes by progress level |

| \*\*Project Team\*\* | Contributors grouped by role (PM, Developer, etc.) | 3-column grid, avatar initials, role headers |

| \*\*Problem Statement\*\* | Problem description text | Rose/orange gradient card |

| \*\*Proposed Solution\*\* | Solution description text | Emerald/teal gradient card |

| \*\*Expected Benefits\*\* | Benefits description text | Blue/indigo gradient card |

| \*\*Man-Hours Savings\*\* | Numeric value with "hours/year" label | Amber/yellow gradient card, large number |

| \*\*Timeline\*\* | Start date and target completion date | 2-column grid, completion date color-coded |

| \*\*Milestones\*\* | Timeline list with completion status | Vertical connector line, checkmark for completed |

| \*\*Media URLs\*\* | Clickable tag buttons for attached URLs | Color-coded by type: violet (Image), sky (Video), amber (Others) |



\### Modal Visual Effects



\- \*\*Backdrop\*\*: Black overlay at 60% opacity with backdrop blur

\- \*\*Entry animation\*\*: Scale up from 0.9 with spring physics (damping: 25, stiffness: 300)

\- \*\*Exit animation\*\*: Scale down to 0.9 with fade out

\- \*\*Stagger animation\*\*: Content sections animate in sequence with 60ms delay between items

\- \*\*Progress bar\*\*: Animated fill from 0% to actual value over 800ms

\- \*\*Decorative elements\*\*: Gradient overlays matching project type color (violet for Hardware, sky for Software)



\### Days Remaining Badge Colors



| Condition | Color | Text |

|-----------|-------|------|

| Overdue | Red | "X days overdue" |

| Due today | Red | "Due today" |

| 1-7 days remaining | Amber | "X days remaining" |

| 8+ days remaining | Emerald | "X days remaining" |



\### Milestone Timeline Display



\- \*\*Completed milestones\*\*: Green checkmark icon, emerald background, strikethrough title

\- \*\*Incomplete milestones\*\*: Empty circle icon, muted background

\- \*\*Connector line\*\*: Vertical line connecting milestones (except after last item)

\- \*\*EDD badge\*\*: Color-coded based on date status (overdue/due-soon/on-track)



\## Project Form Fields



\### Required Fields

\- \*\*Project Name\*\*: Text input for the project title

\- \*\*Problem Statement\*\*: Multi-line textarea describing the problem being solved (min 10 characters)

\- \*\*Solution Type\*\*: Dropdown selection — Hardware or Software

\- \*\*Proposed Solution\*\*: Multi-line textarea describing the proposed approach

\- \*\*Contributors\*\*: One or more contributors, each with:

&#x20; - Personnel name (text input)

&#x20; - Role (dropdown: Project Manager, Developer, End User, Ops Manager, Product Owner)



\### Optional Fields

\- \*\*Expected Benefits\*\*: Multi-line textarea for anticipated outcomes

\- \*\*Project Start Date\*\*: Date picker

\- \*\*Target Completion Date\*\*: Date picker

\- \*\*Est. Man-Hours Saved\*\*: Numeric input for projected efficiency gains



\### Milestones Section (Collapsible)

Each milestone includes:

\- \*\*Milestone Title\*\*: Text input

\- \*\*Expected Delivery Date (EDD)\*\*: Date picker

\- \*\*Milestone Description\*\*: Multi-line textarea

\- \*\*Completed\*\*: Checkbox to mark milestone as done



Note: New milestones can only be added once the previous milestone is marked as completed.



\### Media URLs Section (Collapsible)

Each media URL includes:

\- \*\*URL\*\*: Text input for the media link

\- \*\*Label\*\*: Text input for display name



Multiple URLs can be added per project. URLs are displayed as clickable tag buttons grouped by type in the detail view.



\## Conditional Color Logic



\### Card Date Status Colors

Each project card displays date-based color indicators for Milestone EDD and Target Completion:



| Status | Condition | Color | Usage |

|--------|-----------|-------|-------|

| \*\*Overdue\*\* | Date is in the past | Red (`red-500`) | Border, icon background, text |

| \*\*Due Soon\*\* | Date is within 7 days | Amber (`amber-500`) | Border, icon background, text |

| \*\*On Track\*\* | Date is more than 7 days away | Emerald (`emerald-500`) | Border, icon background, text |

| \*\*TBC\*\* | No date set | Gray (`gray-400`) | Border, icon background, text |



The card's left border color is determined by the \*\*nearest upcoming date\*\* (whichever comes first between Milestone EDD and Target Completion).



\*\*Special cases:\*\*

\- Cards in the "Completed" column always show emerald/on-track styling regardless of dates

\- Cards in the "De-Prioritised" column always show gray/TBC styling



\### Project Type Badge Colors

| Type | Background | Text |

|------|------------|------|

| Hardware | Violet (`violet-100`/`violet-500/20`) | Violet (`violet-700`/`violet-300`) |

| Software | Sky (`sky-100`/`sky-500/20`) | Sky (`sky-700`/`sky-300`) |



\## Button Enable/Disable Logic



\### Add Contributor Button

\- \*\*Enabled\*\*: When all existing contributors have both name AND role filled in

\- \*\*Disabled\*\*: When any contributor is missing name or role



\### Remove Contributor Button (X icon)

\- \*\*Visible\*\*: Only when there are 2+ contributors

\- \*\*Hidden\*\*: When there is only 1 contributor (at least one is always required)



\### Add Milestone Button

\- \*\*Enabled\*\*: When all existing milestones are marked as completed, OR when no milestones exist

\- \*\*Disabled\*\*: When any milestone exists that is not marked as completed

\- Shows error toast: "Please complete the existing milestone before adding a new one"



\### Remove Milestone Button (X icon)

\- \*\*Always visible\*\* for each milestone

\- Allows deletion regardless of completion status



\### Form Submit Button (Create/Update Project)

\- \*\*Enabled\*\*: When form is valid and not currently submitting

\- \*\*Disabled\*\*: During submission (shows loading spinner with "Creating..." or "Updating...")



\### Delete Button (Edit mode only)

\- \*\*Visible\*\*: Only in edit mode (when editing existing project)

\- \*\*Disabled\*\*: During submission or deletion

\- Opens confirmation dialog before deleting



\### Cancel Button

\- \*\*Always enabled\*\* unless form is submitting or deleting

\- Resets form and closes dialog



\## Data Structure



\### AIS Project Tracker Table



The main entity storing all project records with the following fields:



| Field | Type | Required | Description |

|-------|------|----------|-------------|

| \*\*crd49\_AISProjectTracker1Id\*\* | GUID | System | Unique identifier for each project record |

| \*\*crd49\_ProjectName\*\* | String (850) | Yes | Display name of the project |

| \*\*crd49\_ProblemStatement\*\* | Memo (2000) | No | Description of the problem being solved |

| \*\*crd49\_ProjectType\*\* | Picklist | Yes | Hardware or Software |

| \*\*crd49\_ProposedSolution\*\* | Memo (2000) | No | Description of the proposed approach |

| \*\*crd49\_Status\*\* | Picklist | Yes | Ideation, In Progress, Completed, De-Prioritised |

| \*\*crd49\_ContributorsJSONData\*\* | Memo (2000) | No | JSON array of contributor objects with name and role |

| \*\*crd49\_ExpectedBenefits\*\* | Memo (2000) | No | Anticipated outcomes and benefits |

| \*\*crd49\_StartDate\*\* | DateTime | No | Project start date |

| \*\*crd49\_DueDate\*\* | DateTime | No | Target completion date |

| \*\*crd49\_EstManHoursSaved\*\* | Integer | No | Projected man-hours saved |

| \*\*crd49\_MilestonesJSONData\*\* | Memo (2000) | No | JSON array of milestone objects |



\### System Fields (Auto-managed)



| Field | Type | Description |

|-------|------|-------------|

| \*\*CreatedBy\*\* | Lookup | User who created the record |

| \*\*CreatedOn\*\* | DateTime | Timestamp when record was created |

| \*\*ModifiedBy\*\* | Lookup | User who last modified the record |

| \*\*ModifiedOn\*\* | DateTime | Timestamp when record was last modified |

| \*\*CreatedOnBehalfBy\*\* | Lookup | Delegate user who created on behalf |

| \*\*ModifiedOnBehalfBy\*\* | Lookup | Delegate user who modified on behalf |



\### Milestones JSON Structure



The `crd49\_MilestonesJSONData` field stores an array of milestone objects:



```json

\[

&#x20; {

&#x20;   "id": "unique-id",

&#x20;   "title": "Milestone Title",

&#x20;   "edd": "2026-05-01",

&#x20;   "description": "Milestone description text",

&#x20;   "completed": false

&#x20; }

]

```



\### Contributors JSON Structure



Contributors are stored as a JSON array in `crd49\_ContributorsJSONData`:



```json

\[

&#x20; { "name": "John Smith", "role": "Project Manager" },

&#x20; { "name": "Jane Doe", "role": "Developer" }

]

```



\### Project Media URLs (In-Memory Table)



A local in-memory table for storing media URLs associated with projects. Each project can have one record containing multiple URLs stored as JSON.



| Field | Type | Description |

|-------|------|-------------|

| \*\*crd49\_ProjectMediaURLId\*\* | GUID | Unique identifier for each media URL record |

| \*\*crd49\_ProjectID\*\* | String | Foreign key to AIS Project Manager table (project ID) |

| \*\*crd49\_URLJSONData\*\* | Memo | JSON array of URL objects with url and label |



\*\*URL JSON Structure:\*\*

```json

\[

&#x20; { "url": "https://example.com/image1.jpg", "label": "Design Mockup" },

&#x20; { "url": "https://youtube.com/watch?v=abc", "label": "Demo Video" }

]

```



In the detailed view, media URLs are displayed as clickable tag buttons:

\- Clicking a tag button opens the URL in a new browser tab

\- Tags are displayed in a flex-wrap layout for multiple URLs



\### Picklist Values



\*\*Project Type (crd49\_ProjectType):\*\*

\- Hardware

\- Software



\*\*Status (crd49\_Status):\*\*

\- StatusKey0: Ideation (Violet)

\- StatusKey1: In Progress (Amber)

\- StatusKey2: Completed (Emerald)

\- StatusKey3: De-Prioritised (Slate)

