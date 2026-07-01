import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DatabaseService } from './database.service';

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
}

export interface QuizAttempt {
  id: string;
  quizId: number;
  userId: number;
  questions: QuizQuestion[];
  userAnswers: (number | null)[]; // Index of selected option per question, null if not answered
  score: number;
  totalQuestions: number;
  percentageScore: number;
  timeSpent: number; // in seconds
  startedAt: Date;
  completedAt: Date;
  status: 'in-progress' | 'completed' | 'abandoned';
}

export interface QuizResult {
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  timeSpent: number;
  passed: boolean;
  passingScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  difficultyBreakdown: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private quizAttempts$ = new BehaviorSubject<QuizAttempt[]>([]);
  private currentAttempt$ = new BehaviorSubject<QuizAttempt | null>(null);

  // Quiz questions database - 130 questions from UiPath Certified Professional Associate Study Guide (study-guide.md)
  private quizQuestions: QuizQuestion[] = [
    {
      id: 1,
      question: 'A business analyst is selecting candidate processes for automation. Which characteristic makes a process LEAST suitable for traditional RPA?',
      options: ['High volume, performed daily', 'Rule-based with clear decision logic', 'Frequently changing business rules and UI layout', 'Uses structured digital data from a stable application'],
      correctAnswer: 2,
      explanation: 'RPA robots follow fixed, rule-based logic and rely on selectors/UI elements that must remain stable. A process whose rules and UI change frequently requires constant robot maintenance, making ROI poor. Options A, B, and D are textbook indicators of a GOOD RPA candidate, not a bad one.',
      difficulty: 'Easy',
      topic: 'Business Knowledge'
    },
    {
      id: 2,
      question: 'What is the primary purpose of a Process Definition Document (PDD)?',
      options: [
        'To define the technical workflow architecture and selector strategy',
        'To document the AS-IS business process, including exceptions and business rules, from the business perspective',
        'To list Orchestrator assets and queues required for deployment',
        'To record Git commit history for the automation project'
      ],
      correctAnswer: 1,
      explanation: 'The PDD captures the current ("AS-IS") business process in business language — steps, business exceptions, volumes, SLAs — typically co-authored with subject matter experts.',
      difficulty: 'Easy',
      topic: 'Business Knowledge'
    },
    {
      id: 3,
      question: 'Which statement BEST describes the relationship between agentic automation and traditional RPA in the UiPath Platform?',
      options: [
        'Agentic automation fully replaces deterministic RPA workflows',
        'Agentic automation only works with attended robots',
        'Agentic automation adds reasoning/decision-making (via AI agents) to handle ambiguous steps, while deterministic robots continue handling structured, rule-based steps',
        'Agentic automation eliminates the need for Orchestrator'
      ],
      correctAnswer: 2,
      explanation: 'UiPath\'s agentic automation model augments RPA: agents bring judgment and reasoning to unstructured decision points, while traditional robots execute the structured, repeatable parts.',
      difficulty: 'Medium',
      topic: 'Business Knowledge'
    },
    {
      id: 4,
      question: 'A company wants to automate an invoice approval process. Approval thresholds and required approvers change monthly based on shifting finance policy, and invoices arrive in inconsistent formats from many vendors. From a business-knowledge standpoint, what is the MOST appropriate recommendation?',
      options: [
        'Automate the entire process immediately with hard-coded If/Else logic for approval thresholds',
        'Reject automation entirely since the process involves documents',
        'Stabilize/centralize the approval rules (e.g., move thresholds to a config or business rules engine) and consider AI Document Understanding for format variability',
        'Automate only the email notification step and leave everything else manual'
      ],
      correctAnswer: 2,
      explanation: 'Frequently changing rules should be externalized (config files, Orchestrator assets, or a business rules engine) rather than hard-coded. Document format variability is a strong indicator for AI-powered Document Understanding.',
      difficulty: 'Hard',
      topic: 'Business Knowledge'
    },
    // TOPIC 2: PLATFORM KNOWLEDGE (Questions 5-8)
    {
      id: 5,
      question: 'Which robot type is triggered and supervised directly by a human user on their own workstation?',
      options: [
        'Unattended',
        'Attended',
        'Headless',
        'Serverless'
      ],
      correctAnswer: 1,
      explanation: 'Attended robots run on the user\'s own machine and are started by the user, typically via the Assistant, to support them in real time.',
      difficulty: 'Easy',
      topic: 'Platform Knowledge'
    },
    {
      id: 6,
      question: 'A company wants to run unattended robots without managing any underlying virtual machines, scaling robot capacity automatically with demand. Which deployment model fits this requirement?',
      options: [
        'Local',
        'VM-based unattended robot',
        'Serverless robots',
        'Attended robot on a shared kiosk machine'
      ],
      correctAnswer: 2,
      explanation: 'Serverless robots run on UiPath-managed cloud infrastructure, eliminating the need to provision, patch, or scale VMs manually, and they scale on demand.',
      difficulty: 'Medium',
      topic: 'Platform Knowledge'
    },
    {
      id: 7,
      question: 'Which statement about Studio profiles is CORRECT?',
      options: [
        'Studio, StudioX, and Studio Web are entirely separate installers requiring separate licenses with no project compatibility',
        'StudioX is intended for citizen developers with a simplified, ribbon-driven interface, while Studio exposes the full activity set for professional developers',
        'Studio Web cannot be used to build any production automation',
        'StudioX projects can never be opened or edited in Studio'
      ],
      correctAnswer: 1,
      explanation: 'StudioX targets citizen/business-user developers with a simplified ribbon UI, whereas Studio exposes the full breadth of activities for professional RPA developers.',
      difficulty: 'Medium',
      topic: 'Platform Knowledge'
    },
    {
      id: 8,
      question: 'What is the main role of Integration Service within the UiPath Platform?',
      options: [
        'It replaces Orchestrator\'s job scheduling capabilities',
        'It provides pre-built connectors, triggers, and integration capabilities to third-party applications, usable from within Studio workflows',
        'It is exclusively used to manage robot licenses',
        'It stores DataTables for use across multiple processes'
      ],
      correctAnswer: 1,
      explanation: 'Integration Service exposes pre-built connectors (e.g., to Salesforce, Microsoft 365, Jira) and event-driven triggers that workflows can call via dedicated activity packages.',
      difficulty: 'Easy',
      topic: 'Platform Knowledge'
    },
    // TOPIC 3: STUDIO INTERFACE (Questions 9-11)
    {
      id: 9,
      question: 'A developer wants to start building automations without installing any desktop software, working from a Chromebook. Which UiPath tool should they use?',
      options: [
        'Studio (desktop)',
        'Studio Web',
        'StudioX desktop installer',
        'Orchestrator robot tray'
      ],
      correctAnswer: 1,
      explanation: 'Studio Web is a browser-based design experience requiring no local installation, making it accessible cross-platform, including from devices like Chromebooks.',
      difficulty: 'Easy',
      topic: 'Studio Interface'
    },
    {
      id: 10,
      question: 'In desktop Studio, where would a developer go to manage recent projects, settings, and plugins, separate from the workflow design canvas?',
      options: [
        'The Object Repository panel',
        'Backstage view',
        'The Output panel',
        'Workflow Analyzer panel'
      ],
      correctAnswer: 1,
      explanation: 'Backstage is the landing area in Studio for managing projects, templates, settings, and plugins, separate from the actual workflow design canvas.',
      difficulty: 'Easy',
      topic: 'Studio Interface'
    },
    {
      id: 11,
      question: 'Which statement correctly distinguishes Modern and Classic project design experiences in current Studio?',
      options: [
        'Classic is recommended for all new projects going forward',
        'Modern is the recommended experience for new automations, supporting newer UI Automation and Object Repository capabilities, while Classic remains primarily for legacy compatibility',
        'Modern only works with unattended robots',
        'Classic and Modern cannot coexist in the same Studio installation'
      ],
      correctAnswer: 1,
      explanation: 'Modern design experience is recommended for new projects due to newer UI Automation features and Object Repository support, while Classic remains for legacy compatibility.',
      difficulty: 'Medium',
      topic: 'Studio Interface'
    },
    // TOPIC 4: VARIABLES & ARGUMENTS (Questions 12-15)
    {
      id: 12,
      question: 'A developer creates a variable inside a Sequence nested within a Flowchart\'s "Process" node. Where can this variable be used?',
      options: [
        'Anywhere in the entire project',
        'Only within that specific Sequence (its defining container), unless its scope is manually changed',
        'Only within the Flowchart, but not the Sequence itself',
        'In any workflow invoked from this Flowchart'
      ],
      correctAnswer: 1,
      explanation: 'A variable\'s default scope is the smallest container in which it is created. To use it elsewhere, you must explicitly move its scope up.',
      difficulty: 'Easy',
      topic: 'Variables and Arguments'
    },
    {
      id: 13,
      question: 'An invoked workflow has an argument `out_InvoiceTotal` (Out, Decimal) that is never assigned inside the invoked workflow\'s logic. What value will the calling workflow receive?',
      options: [
        'The workflow will throw a compile-time error preventing execution',
        'Null, regardless of data type',
        'The default value for Decimal (0), since Out arguments return the type\'s default if unassigned',
        'The value will be undefined and cause a runtime crash every time'
      ],
      correctAnswer: 2,
      explanation: 'If an Out argument isn\'t explicitly assigned, it returns the default value for its data type (0 for numeric types, Nothing for reference types).',
      difficulty: 'Hard',
      topic: 'Variables and Arguments'
    },
    {
      id: 14,
      question: 'Which of the following BEST distinguishes a Global Constant from a Global Variable in UiPath Studio?',
      options: [
        'Global Constants can only store strings; Global Variables can store any type',
        'Global Constants are immutable at runtime, while Global Variables can be reassigned during execution',
        'Global Variables are project-wide, but Global Constants are limited to a single workflow',
        'There is no functional difference; they are interchangeable terms'
      ],
      correctAnswer: 1,
      explanation: 'The defining difference is mutability: a Global Constant\'s value is fixed and cannot be changed at runtime, while a Global Variable can be reassigned as the automation executes.',
      difficulty: 'Medium',
      topic: 'Variables and Arguments'
    },
    {
      id: 15,
      question: 'A developer types `"Invoice_" + DateTime.Now.ToString("yyyyMMdd")` directly into a Path property field of a "Create File" activity without manually declaring a variable beforehand. What does Studio do with this expression?',
      options: [
        'It throws a compile error since literal expressions aren\'t allowed in property fields',
        'It silently ignores the input',
        'Studio evaluates the expression inline at runtime; no separate variable is required for a one-off literal/expression value',
        'It automatically converts the activity into an Invoke Code activity'
      ],
      correctAnswer: 2,
      explanation: 'Studio allows inline VB.NET expressions directly in property fields, which are evaluated at runtime each time the activity executes.',
      difficulty: 'Medium',
      topic: 'Variables and Arguments'
    },
    // TOPIC 5: CONTROL FLOW (Questions 16-20)
    {
      id: 16,
      question: 'What is the key behavioral difference between a While activity and a Do While activity?',
      options: [
        'While always executes at least once; Do While may execute zero times',
        'While checks its condition before each iteration (may execute zero times); Do While checks after each iteration (executes at least once)',
        'Do While is only usable with DataTables',
        'There is no behavioral difference; they are identical activities with different icons'
      ],
      correctAnswer: 1,
      explanation: 'While evaluates its condition BEFORE the loop body runs. Do While evaluates its condition AFTER the loop body runs, guaranteeing at least one execution.',
      difficulty: 'Easy',
      topic: 'Control Flow'
    },
    {
      id: 17,
      question: 'A developer needs to process every row of a DataTable called `dtInvoices`. Which activity and typing is correct?',
      options: [
        'While loop with `dtInvoices.Rows.Count` as the condition only',
        'For Each activity with TypeArgument set to DataRow, iterating over `dtInvoices.Rows`',
        'For Each activity with TypeArgument set to DataTable, iterating over `dtInvoices`',
        'Do While activity iterating over `dtInvoices.Columns`'
      ],
      correctAnswer: 1,
      explanation: 'To iterate DataTable rows, a For Each activity should iterate over `dtInvoices.Rows` with its TypeArgument set to `DataRow` so each loop variable represents one row.',
      difficulty: 'Medium',
      topic: 'Control Flow'
    },
    {
      id: 18,
      question: 'In a Flowchart, which activity is the direct visual equivalent of an If/Else branch used inside a Sequence?',
      options: [
        'Switch',
        'Flow Decision',
        'While',
        'Try Catch'
      ],
      correctAnswer: 1,
      explanation: 'Flow Decision is the Flowchart-native branching activity, offering True/False outgoing connections to different nodes, mirroring what an If/Else does inside a Sequence.',
      difficulty: 'Easy',
      topic: 'Control Flow'
    },
    {
      id: 19,
      question: 'A developer wants to route execution based on an Invoice "Status" string that can be "New", "Pending", "Approved", "Rejected", or any other unexpected value. What is the BEST activity choice for readability and maintainability?',
      options: [
        'A chain of 5 nested If activities',
        'A single Switch activity with cases for each known status and a Default case for unexpected values',
        'A single While loop checking the status repeatedly',
        'A Flow Decision with only two branches'
      ],
      correctAnswer: 1,
      explanation: 'Switch is purpose-built for matching one value against multiple discrete cases, including a Default case to handle unexpected values — exactly this scenario.',
      difficulty: 'Medium',
      topic: 'Control Flow'
    },
    {
      id: 20,
      question: 'What is the result of the VB.NET expression `If(orderTotal > 500, "Priority", "Standard")` when `orderTotal = 500`?',
      options: [
        '"Priority"',
        '"Standard"',
        'A runtime exception, since 500 is a boundary value',
        'Nothing/null'
      ],
      correctAnswer: 1,
      explanation: 'The condition `orderTotal > 500` uses strictly-greater-than, so when orderTotal equals exactly 500, the condition evaluates to False, returning "Standard".',
      difficulty: 'Hard',
      topic: 'Control Flow'
    },
    // TOPIC 6: DEBUGGING (Questions 41-45)
    {
      id: 21,
      question: 'A developer is debugging a workflow with an Invoke Workflow File activity and wants to inspect what happens INSIDE the invoked workflow step-by-step. Which control should they use?',
      options: [
        'Step Over',
        'Step Out',
        'Step Into',
        'Run to Cursor only'
      ],
      correctAnswer: 2,
      explanation: 'Step Into enters the invoked workflow itself, allowing step-by-step inspection of its internal activities. Step Over executes the entire workflow as a black box.',
      difficulty: 'Easy',
      topic: 'Debugging'
    },
    {
      id: 22,
      question: 'A developer wants to pause execution only when a loop counter variable `i` equals 50, without stopping on every other iteration. What should they configure?',
      options: [
        'A standard breakpoint on the loop activity',
        'A tracepoint with message "i = 50"',
        'A conditional breakpoint with the condition `i = 50`',
        'A Log Message activity inside the loop printing every value of i'
      ],
      correctAnswer: 2,
      explanation: 'A conditional breakpoint only halts execution when its specified condition evaluates to True, making it ideal for pausing on a specific iteration.',
      difficulty: 'Medium',
      topic: 'Debugging'
    },
    {
      id: 23,
      question: 'What is the key functional difference between a Tracepoint and a standard Breakpoint?',
      options: [
        'Tracepoints can only be used in Release/Run mode; breakpoints only in Debug mode',
        'A Tracepoint logs information to the Output panel without halting execution; a Breakpoint halts execution when reached',
        'There is no difference; they are the same feature with different icons',
        'Tracepoints can only be set on Log Message activities'
      ],
      correctAnswer: 1,
      explanation: 'A Tracepoint allows non-intrusive runtime inspection by writing to the Output panel while execution continues, whereas a Breakpoint pauses execution entirely.',
      difficulty: 'Medium',
      topic: 'Debugging'
    },
    {
      id: 24,
      question: 'While paused at a breakpoint inside an invoked workflow three levels deep, which panel shows the chain of calling workflows that led to this point?',
      options: [
        'Locals',
        'Watch',
        'Call Stack',
        'Breakpoints panel'
      ],
      correctAnswer: 2,
      explanation: 'The Call Stack panel displays the sequence of invoked workflows leading to the current execution point, especially useful for deeply nested workflow debugging.',
      difficulty: 'Medium',
      topic: 'Debugging'
    },
    {
      id: 25,
      question: 'A developer needs to monitor a DataTable variable continuously across different invoked workflows during debug, beyond just its local scope. Which panel is BEST suited?',
      options: [
        'Locals panel only',
        'Watch panel',
        'Output panel',
        'Call Stack panel'
      ],
      correctAnswer: 1,
      explanation: 'The Watch panel lets a developer pin variables to track them persistently across different scopes and invoked workflows, unlike Locals which only reflects current-scope variables.',
      difficulty: 'Hard',
      topic: 'Debugging'
    },
    // TOPIC 7: EXCEPTION HANDLING (Questions 46-50)
    {
      id: 26,
      question: 'A Try Catch activity has two Catch blocks in this order: (1) `System.Exception`, (2) `System.IO.FileNotFoundException`. A FileNotFoundException is thrown inside the Try block. Which Catch block handles it?',
      options: [
        'The FileNotFoundException catch, since it\'s more specific',
        'The System.Exception catch, since it\'s listed first and matches any exception including FileNotFoundException',
        'Neither — the exception propagates unhandled',
        'Both catch blocks execute in sequence'
      ],
      correctAnswer: 1,
      explanation: 'Catch blocks are evaluated top to bottom, and the FIRST matching type handles the exception. Since System.Exception is a base class that FileNotFoundException inherits from, it matches first.',
      difficulty: 'Hard',
      topic: 'Exception Handling'
    },
    {
      id: 27,
      question: 'Inside a Catch block, a developer wants to log the exception and then propagate it further up the call stack while preserving the original stack trace. Which activity should they use?',
      options: [
        'Throw New Exception(ex.Message)',
        'Rethrow',
        'Continue (no activity, just let the workflow end)',
        'Terminate Workflow'
      ],
      correctAnswer: 1,
      explanation: 'Rethrow re-raises the currently caught exception exactly as it was caught, preserving its original stack trace and type — ideal for "log then propagate" patterns.',
      difficulty: 'Medium',
      topic: 'Exception Handling'
    },
    {
      id: 28,
      question: 'What is guaranteed about the Finally block of a Try Catch activity?',
      options: [
        'It only runs if an exception was caught',
        'It only runs if NO exception occurred',
        'It always runs, regardless of whether an exception occurred or was caught',
        'It only runs if the developer manually calls it'
      ],
      correctAnswer: 2,
      explanation: 'The Finally block is designed to ALWAYS execute — whether the Try block completed successfully, an exception was caught and handled, or if a Rethrow occurs.',
      difficulty: 'Easy',
      topic: 'Exception Handling'
    },
    {
      id: 29,
      question: 'A UI automation step occasionally fails because a confirmation dialog takes a few extra seconds to appear due to network latency. What is the MOST appropriate activity to handle this?',
      options: [
        'Wrap the step in a Try Catch with a generic System.Exception catch and do nothing',
        'Use a Retry Scope with a Condition checking for the dialog\'s existence, allowing several automatic retries',
        'Add a Throw activity immediately after the step',
        'Remove error handling entirely since it\'s "just a delay"'
      ],
      correctAnswer: 1,
      explanation: 'Retry Scope is purpose-built for transient, timing-related failures, re-attempting the Action until the Condition is satisfied or the retry limit is reached.',
      difficulty: 'Medium',
      topic: 'Exception Handling'
    },
    {
      id: 30,
      question: 'A developer catches a `BusinessRuleException` (e.g., "Invoice amount is negative") inside a Retry Scope\'s Action. Is retrying this exception type generally a good practice?',
      options: [
        'Yes, always retry every exception type for maximum resilience',
        'No — business exceptions typically indicate bad data/business logic, not transient failures, so retrying won\'t fix the underlying issue',
        'Yes, but only if NumberOfRetries is set above 10',
        'It doesn\'t matter; Retry Scope behaves identically for all exception types'
      ],
      correctAnswer: 1,
      explanation: 'Business exceptions reflect data or business-rule problems that retrying will NOT resolve. Best practice is to route such exceptions to a queue/Action Center for human review.',
      difficulty: 'Hard',
      topic: 'Exception Handling'
    },
    // TOPIC 8: LOGGING (Questions 51-53)
    {
      id: 31,
      question: 'Which log level is MOST appropriate for a message indicating "Invoice 4521 processed successfully" during normal operation?',
      options: [
        'Trace',
        'Information',
        'Error',
        'Fatal'
      ],
      correctAnswer: 1,
      explanation: '"Information" level is intended for normal operational milestones that confirm expected progress, such as successful completion of a business transaction.',
      difficulty: 'Easy',
      topic: 'Logging'
    },
    {
      id: 32,
      question: 'A developer wants every Log Message inside a block of activities to automatically include a `TransactionID` field without manually adding it to each message. What should they use?',
      options: [
        'A separate variable named LogContext',
        'Add Log Fields activity wrapping that block',
        'A Global Constant for TransactionID',
        'A Comment activity above each Log Message'
      ],
      correctAnswer: 1,
      explanation: '`Add Log Fields` attaches specified key-value metadata to all Log Message activities executed within its scope automatically, avoiding repetitive manual entry.',
      difficulty: 'Medium',
      topic: 'Logging'
    },
    {
      id: 33,
      question: 'Which of the following should be AVOIDED in production log messages, per best practice?',
      options: [
        'Transaction/invoice identifiers',
        'Process milestone descriptions',
        'Plain-text passwords or full payment card numbers',
        'Timestamps'
      ],
      correctAnswer: 2,
      explanation: 'Logging sensitive data such as plain-text passwords or full payment card numbers is a serious security/compliance risk and should always be avoided or masked.',
      difficulty: 'Easy',
      topic: 'Logging'
    },
    // TOPIC 9: UI AUTOMATION (Questions 54-57)
    {
      id: 34,
      question: 'An automation needs to interact with an application running inside a Citrix virtual desktop session where standard UiPath selectors cannot identify individual UI elements. Which targeting method is MOST appropriate?',
      options: [
        'Strict selectors',
        'Computer Vision',
        'Fuzzy selectors with a 100% similarity threshold',
        'Dynamic descriptors using selector wildcards'
      ],
      correctAnswer: 1,
      explanation: 'Computer Vision is specifically designed for Citrix and other virtualized/remote desktop environments where the underlying UI Automation tree isn\'t accessible to standard selector-based targeting.',
      difficulty: 'Medium',
      topic: 'UI Automation'
    },
    {
      id: 35,
      question: 'A web page generates a unique, randomly changing `id` attribute for a button every time the page loads, while the button\'s relative position and nearby stable label remain constant. What is the BEST fix?',
      options: [
        'Switch the entire automation to Image automation',
        'Use a Dynamic descriptor — anchor the target to the stable nearby label, or wildcard the variable `id` attribute',
        'Increase the Delay Before property to 10 seconds',
        'Use a Fuzzy selector with a 50% similarity threshold'
      ],
      correctAnswer: 1,
      explanation: 'The textbook fix for an attribute that legitimately changes at runtime is to use a Dynamic descriptor: either anchor to something stable or use a wildcard.',
      difficulty: 'Hard',
      topic: 'UI Automation'
    },
    {
      id: 36,
      question: 'Which activity should be used to wait reliably for a loading spinner to disappear before continuing, instead of using a hard-coded Delay?',
      options: [
        'Element Exists',
        'Wait Element Vanish',
        'Get Text',
        'Click'
      ],
      correctAnswer: 1,
      explanation: 'Wait Element Vanish is purpose-built to pause execution until a specified element (like a loading spinner) is no longer present, providing reliable synchronization.',
      difficulty: 'Easy',
      topic: 'UI Automation'
    },
    {
      id: 37,
      question: 'What is a key disadvantage of using a Strict selector compared to a Fuzzy selector?',
      options: [
        'Strict selectors are always slower to execute',
        'Strict selectors require an exact attribute match and break if even minor attribute values change, reducing robustness to UI changes',
        'Strict selectors cannot be used with Modern Design activities',
        'Strict selectors only work with Computer Vision'
      ],
      correctAnswer: 1,
      explanation: 'Strict selectors require exact attribute matching, so any minor change causes the selector to fail, whereas Fuzzy selectors tolerate some variation via a similarity threshold.',
      difficulty: 'Medium',
      topic: 'UI Automation'
    },
    // TOPIC 10: OBJECT REPOSITORY (Questions 58-60) - Creating additional questions
    {
      id: 38,
      question: 'What is the primary hierarchical structure of the Object Repository in UiPath?',
      options: [
        'Element → Screen → Application',
        'Application → Screen → Element',
        'Project → Element → Screen',
        'Screen → Application → Element'
      ],
      correctAnswer: 1,
      explanation: 'The Object Repository organizes UI targets hierarchically: Application → Screen → Element, enabling centralized reuse of UI descriptors across workflows.',
      difficulty: 'Easy',
      topic: 'Object Repository'
    },
    {
      id: 39,
      question: 'What is a UI Library in the UiPath Platform?',
      options: [
        'A collection of workflow templates bundled together',
        'A published, versioned package containing Object Repository descriptors that can be shared across multiple automation projects',
        'A tool for managing robot deployments',
        'A built-in set of only standard/pre-built UI activities'
      ],
      correctAnswer: 1,
      explanation: 'A UI Library is a published, versioned package built from an Object Repository, allowing UI element descriptors to be shared and reused across MULTIPLE separate automation projects.',
      difficulty: 'Medium',
      topic: 'Object Repository'
    },
    {
      id: 40,
      question: 'What is the primary benefit of using the Object Repository over hard-coding selectors directly in workflow activities?',
      options: [
        'Faster execution speed',
        'Centralized, reusable UI descriptors that can be updated once and reflected across all workflows using them, improving maintainability',
        'Automatic encryption of sensitive selectors',
        'Reduced need for testing'
      ],
      correctAnswer: 1,
      explanation: 'The Object Repository provides centralized, reusable UI targets — when a UI element changes, you update it once in the Repository and all workflows using it automatically reflect the change.',
      difficulty: 'Medium',
      topic: 'Object Repository'
    },
    // Additional 20 questions to reach 60 total
    {
      id: 41,
      question: 'Which of the following BEST describes the AS-IS vs TO-BE relationship in process automation documentation?',
      options: [
        'AS-IS and TO-BE are the same document with different file extensions',
        'AS-IS describes the current business process (PDD), while TO-BE describes the technical automation design (SDD)',
        'AS-IS is technical, TO-BE is business-focused',
        'They only apply to attended automation scenarios'
      ],
      correctAnswer: 1,
      explanation: 'AS-IS (captured in PDD) describes the current business process from a business perspective, while TO-BE (captured in SDD) describes the desired technical automation design.',
      difficulty: 'Medium',
      topic: 'Business Knowledge'
    },
    {
      id: 42,
      question: 'What is the primary difference between an In argument and an In/Out argument in a workflow?',
      options: [
        'In arguments are strings only; In/Out arguments can be any type',
        'In arguments are read-only inside the workflow; In/Out arguments can be modified and returned to the caller',
        'In arguments flow into workflows; In/Out arguments flow out only',
        'There is no practical difference; they are synonymous'
      ],
      correctAnswer: 1,
      explanation: 'An In argument passes data into a workflow and is read-only within it. An In/Out argument allows the workflow to modify the value and return the modified version to the caller.',
      difficulty: 'Medium',
      topic: 'Variables and Arguments'
    },
    {
      id: 43,
      question: 'A For Each loop iterates over a collection of 1000 items. Inside the loop, a counter variable is incremented, but the loop logic never updates the counter variable. What is likely the issue?',
      options: [
        'The counter variable is defined outside the loop scope and cannot be accessed',
        'The For Each activity has a bug preventing iteration',
        'The counter variable exists but is not being used properly; it should be placed outside the For Each to persist across iterations',
        'Nothing — this is a valid scenario'
      ],
      correctAnswer: 2,
      explanation: 'For a counter to track across loop iterations, it must be defined OUTSIDE the For Each loop body in a parent container. If defined inside, it resets with each iteration.',
      difficulty: 'Hard',
      topic: 'Control Flow'
    },
    {
      id: 44,
      question: 'Why is it important to order Catch blocks from most specific to most general exception types?',
      options: [
        'To improve code execution speed',
        'It is not important — catch block order doesn\'t affect behavior',
        'Because the first matching Catch block handles the exception; a general exception type placed first will "swallow" all exceptions below it (dead code)',
        'Because exceptions always occur in a specific order'
      ],
      correctAnswer: 2,
      explanation: 'Catch blocks are evaluated top to bottom, and the first matching type handles the exception. If System.Exception (general) is placed before FileNotFoundException (specific), the specific catch becomes unreachable dead code.',
      difficulty: 'Hard',
      topic: 'Exception Handling'
    },
    {
      id: 45,
      question: 'When would you use a Retry Scope instead of a While loop with a manual retry counter?',
      options: [
        'Retry Scope is only for attended robots',
        'Retry Scope provides built-in retry logic, automatic exception handling, and delay between attempts — ideal for transient failures without manual counter management',
        'While loops are always preferred over Retry Scope',
        'They perform identically; choice is purely stylistic'
      ],
      correctAnswer: 1,
      explanation: 'Retry Scope is purpose-built for retry scenarios, handling the retry count, delay timing, and exception conditions automatically, whereas While loops require manual implementation.',
      difficulty: 'Medium',
      topic: 'Exception Handling'
    },
    {
      id: 46,
      question: 'A Log Message activity is configured with Level: "Warning" and message: "Invoice 5000 amount seems unusually high". Where will this message appear?',
      options: [
        'Only in Orchestrator, never in local Output panel',
        'Only in the local Output panel during Studio runs, and in Orchestrator when the robot is connected',
        'In both local Output panel and Orchestrator logs, depending on robot configuration and log level thresholds',
        'In a separate Warning-level file only'
      ],
      correctAnswer: 2,
      explanation: 'Log messages appear in the Output panel during local Studio runs and are also transmitted to Orchestrator when a robot is connected, subject to configured log level thresholds.',
      difficulty: 'Medium',
      topic: 'Logging'
    },
    {
      id: 47,
      question: 'Which Modern Design feature significantly improves UI selector maintenance by centralizing UI element definitions?',
      options: [
        'Workflow variables',
        'Object Repository',
        'Orchestrator assets',
        'Global constants'
      ],
      correctAnswer: 1,
      explanation: 'The Object Repository is a cornerstone of Modern Design, providing a centralized, reusable store of UI element descriptors (Applications → Screens → Elements).',
      difficulty: 'Easy',
      topic: 'Studio Interface'
    },
    {
      id: 48,
      question: 'Why might a developer choose to use Element Exists activity followed by conditional logic instead of Wait Element Vanish in certain scenarios?',
      options: [
        'Element Exists is always faster',
        'Element Exists checks current state without waiting, allowing custom retry/conditional logic, while Wait Element Vanish blocks until the element disappears',
        'Wait Element Vanish does not work in Modern Design',
        'There is no practical reason; Always use Wait Element Vanish'
      ],
      correctAnswer: 1,
      explanation: 'Element Exists (Boolean check) vs Wait Element Vanish (blocking wait) serve different purposes. Element Exists allows custom logic/conditions, while Wait Element Vanish is simpler for straightforward wait-until-gone scenarios.',
      difficulty: 'Hard',
      topic: 'UI Automation'
    },
    {
      id: 49,
      question: 'In a Flowchart containing multiple decision nodes, how is the flow of execution determined when a condition on a Flow Decision evaluates to False?',
      options: [
        'Execution always terminates',
        'Execution follows the connection arrow labeled "False" from the Flow Decision node',
        'Execution defaults to the first connected node alphabetically',
        'A runtime error is raised'
      ],
      correctAnswer: 1,
      explanation: 'A Flow Decision has two outgoing connections: "True" and "False". When the condition evaluates to False, execution follows the "False" arrow to the next node.',
      difficulty: 'Easy',
      topic: 'Control Flow'
    },
    {
      id: 50,
      question: 'What is the significance of the "Default" case in a Switch activity?',
      options: [
        'It is optional and has no special meaning',
        'It catches all values that do not match any of the explicitly defined cases, providing graceful handling of unexpected inputs',
        'It only applies to unattended robots',
        'It runs before all other cases'
      ],
      correctAnswer: 1,
      explanation: 'The Default case in a Switch activity acts as a catch-all, handling any value that doesn\'t match the explicitly defined case values, ensuring robust error-resilient logic.',
      difficulty: 'Medium',
      topic: 'Control Flow'
    },
    {
      id: 51,
      question: 'When using Studio Web, what is a key limitation compared to desktop Studio?',
      options: [
        'Studio Web cannot access any activity packages',
        'Studio Web is always slower than desktop Studio',
        'Some advanced features or specific activity packages available in desktop Studio may not be available in Studio Web',
        'Studio Web cannot build unattended automations'
      ],
      correctAnswer: 2,
      explanation: 'Studio Web is a browser-based, lighter-weight environment. While it supports most common scenarios, some advanced features or specialized activity packages may only be available in desktop Studio.',
      difficulty: 'Medium',
      topic: 'Studio Interface'
    },
    {
      id: 52,
      question: 'Which Robot deployment method is typically used for high-volume, unattended back-office automation?',
      options: [
        'Attended robots only',
        'Unattended robots on dedicated VMs or machines, often managed/scaled through Orchestrator',
        'Only local robots on developer workstations',
        'Image-based robots'
      ],
      correctAnswer: 1,
      explanation: 'Unattended robots deployed on dedicated virtual or physical machines and scheduled/managed through Orchestrator are the standard for high-volume back-office automation.',
      difficulty: 'Easy',
      topic: 'Platform Knowledge'
    },
    {
      id: 53,
      question: 'How does the Watch panel differ from the Locals panel when debugging a nested workflow invocation?',
      options: [
        'Watch and Locals show identical information',
        'Locals shows all variables in current scope only; Watch shows variables you\'ve pinned, updating across scope changes as execution flows between workflows',
        'Watch is only for production debugging',
        'Locals can track outside the current scope; Watch cannot'
      ],
      correctAnswer: 1,
      explanation: 'Locals dynamically reflects variables currently in scope at the paused point, while Watch allows you to pin variables to monitor persistently across scope transitions and nested workflows.',
      difficulty: 'Medium',
      topic: 'Debugging'
    },
    {
      id: 54,
      question: 'What happens if you use Rethrow outside of a Catch block?',
      options: [
        'It re-throws the last exception caught anywhere in the project',
        'It has no effect and execution continues normally',
        'It is a compile-time error because Rethrow is only valid inside a Catch block',
        'It throws a new generic exception'
      ],
      correctAnswer: 2,
      explanation: 'Rethrow is designed exclusively for use within Catch blocks to re-raise the currently caught exception. Using it outside a Catch block results in a compile-time error.',
      difficulty: 'Hard',
      topic: 'Exception Handling'
    },
    {
      id: 55,
      question: 'In terms of security best practices, why should you avoid logging payment card numbers or passwords?',
      options: [
        'It will always cause compilation errors',
        'Logs may be accessible to unauthorized personnel, creating security and compliance violations; sensitive data should be masked or omitted',
        'It will slow down the automation',
        'There is no security concern; logging anything is fine'
      ],
      correctAnswer: 1,
      explanation: 'Logging plain-text sensitive data like payment card numbers or passwords exposes them in log files that may be accessible to unauthorized personnel, violating security policies and compliance regulations.',
      difficulty: 'Easy',
      topic: 'Logging'
    },
    {
      id: 56,
      question: 'When should you prefer a Dynamic descriptor over a Strict selector in UI automation?',
      options: [
        'Always prefer Strict selectors for maximum performance',
        'When UI attributes (like IDs or text) change dynamically at runtime, use wildcards or anchor-based descriptors to remain robust to these changes',
        'Never use Dynamic descriptors; they are unreliable',
        'Dynamic descriptors only work with Image automation'
      ],
      correctAnswer: 1,
      explanation: 'Dynamic descriptors (using wildcards, anchors, or relative positioning) handle runtime-changing attribute values gracefully, while Strict selectors break when attributes change.',
      difficulty: 'Medium',
      topic: 'UI Automation'
    },
    {
      id: 57,
      question: 'What is the relationship between a published UI Library and multiple automation projects?',
      options: [
        'Each project must create its own Object Repository; sharing is not possible',
        'A published UI Library (containing Object Repository descriptors) can be added as a dependency to multiple projects, enabling reuse of UI element definitions across projects',
        'UI Libraries only work with attended robots',
        'Publishing a UI Library deletes the original Object Repository'
      ],
      correctAnswer: 1,
      explanation: 'A published UI Library is a versioned, reusable package of UI element descriptors that multiple projects can consume as dependencies, centralizing UI maintenance across the portfolio.',
      difficulty: 'Hard',
      topic: 'Object Repository'
    },
    {
      id: 58,
      question: 'Which RPA candidate identification factor is most critical to assess before recommending automation?',
      options: [
        'The process must use only one application',
        'The process must be rule-based, repetitive, high-volume, stable, and use structured data',
        'The process must involve human decision-making',
        'The process must run only during business hours'
      ],
      correctAnswer: 1,
      explanation: 'Ideal RPA candidates are rule-based (no complex judgment), repetitive, high-volume (good ROI), stable (low maintenance), and work with structured/semi-structured data.',
      difficulty: 'Medium',
      topic: 'Business Knowledge'
    },
    {
      id: 59,
      question: 'How does Agentic automation complement traditional RPA in handling complex business processes?',
      options: [
        'Agentic automation replaces RPA entirely',
        'Agents handle judgment/reasoning decisions (unstructured steps), while robots continue executing deterministic, rule-based actions reliably',
        'Agentic automation only works offline',
        'They serve the same purpose; choice is stylistic only'
      ],
      correctAnswer: 1,
      explanation: 'Agentic automation adds AI-based reasoning to handle ambiguous, unstructured decision points within otherwise rule-based automations, complementing but not replacing traditional RPA robots.',
      difficulty: 'Hard',
      topic: 'Business Knowledge'
    },
    {
      id: 60,
      question: 'What is the recommended approach when a workflow\'s Argument is constantly unassigned, causing unexpected default values to be returned?',
      options: [
        'Ignore it; default values are acceptable',
        'Review the workflow logic to ensure all Out/In-Out arguments receive explicit assignments; if logic is conditionally assigning, initialize with a sensible default before the conditional',
        'Change the argument type to Variant',
        'Use null instead of default values'
      ],
      correctAnswer: 1,
      explanation: 'Unassigned Out/In-Out arguments silently return type defaults (0, Nothing, empty string), often causing subtle bugs. Best practice: always explicitly assign them and initialize defaults upfront.',
      difficulty: 'Hard',
      topic: 'Variables and Arguments'
    },
    {
      id: 61,
      question: 'What distinguishes a UI Library from a regular (workflow) Library in UiPath?',
      options: ['A UI Library can only be used with Computer Vision', 'A UI Library is built around Object Repository content (reusable UI element descriptors), while a regular Library shares reusable workflow logic/activities, though both are published and consumed similarly', 'UI Libraries cannot be versioned', 'There is no difference — they are the same artifact'],
      correctAnswer: 1,
      explanation: 'Both are published/consumed via the same package mechanism (dependencies, versioning via Manage Packages), but their CONTENT differs: a UI Library packages Object Repository elements (Applications/Screens/Elements) for reuse across projects, while a regular Library packages reusable custom workflows/activities. Option A is false — UI Libraries aren\'t tied exclusively to Computer Vision. Option C is false — UI Libraries are versioned just like regular libraries. Option D ignores this meaningful content distinction tested on the exam.',
      difficulty: 'Medium',
      topic: 'Object Repository'
    },
    {
      id: 62,
      question: 'A descriptor for "Order Row" inside the Object Repository needs to match a table row whose text contains a variable order number that changes per transaction. What is the correct way to handle this WITHIN the Object Repository itself?',
      options: ['Create a brand-new static descriptor for every possible order number', 'Configure the element as a dynamic descriptor, parameterizing the variable portion of the selector (e.g., passing the order number as a runtime parameter) so one reusable descriptor handles all order numbers', 'Move the element out of the Object Repository entirely and hard-code it inline instead', 'Switch the project from Modern to Classic design experience'],
      correctAnswer: 1,
      explanation: 'The Object Repository fully supports dynamic descriptors — selector parts can be parameterized so a single reusable descriptor adapts to runtime values (like a variable order number) passed in when the activity executes, rather than needing a unique static descriptor per possible value. Option A is impractical and defeats the purpose of reusability. Option C abandons the benefits of centralized management unnecessarily. Option D is irrelevant — dynamic descriptors are supported in the Object Repository regardless of Modern/Classic and switching wouldn\'t solve the variability problem anyway.',
      difficulty: 'Hard',
      topic: 'Object Repository'
    },
    {
      id: 63,
      question: 'Which control steps INSIDE an invoked workflow during debugging?',
      options: ['Step Over', 'Step Into', 'Step Out', 'Run to Cursor'],
      correctAnswer: 1,
      explanation: 'Step Into enters the invoked workflow itself, allowing the developer to step through its internal activities one by one.',
      difficulty: 'Easy',
      topic: 'Debugging'
    },
    {
      id: 64,
      question: 'A breakpoint that only pauses when a condition is true is called:',
      options: ['Tracepoint', 'Standard breakpoint', 'Conditional breakpoint', 'Watch breakpoint'],
      correctAnswer: 2,
      explanation: 'A conditional breakpoint only halts execution when its specified condition evaluates to True.',
      difficulty: 'Easy',
      topic: 'Debugging'
    },
    {
      id: 65,
      question: 'Which panel shows the chain of invoked workflows leading to the current paused point?',
      options: ['Locals', 'Watch', 'Call Stack', 'Output'],
      correctAnswer: 2,
      explanation: 'The Call Stack panel displays the sequence of invoked workflows (the "call chain") that led to the current execution point.',
      difficulty: 'Easy',
      topic: 'Debugging'
    },
    {
      id: 66,
      question: 'Catch blocks should be ordered:',
      options: ['Most general first', 'Most specific first', 'Alphabetically', 'Order doesn\'t matter'],
      correctAnswer: 1,
      explanation: 'Catch blocks are evaluated top to bottom, and the FIRST matching type handles the exception. Specific exception types must be listed BEFORE general ones.',
      difficulty: 'Medium',
      topic: 'Exception Handling'
    },
    {
      id: 67,
      question: 'Rethrow can be used:',
      options: ['Anywhere', 'Only inside Catch', 'Only inside Try', 'Only inside Finally'],
      correctAnswer: 1,
      explanation: 'Rethrow can only be used inside a Catch block to re-raise the currently caught exception.',
      difficulty: 'Easy',
      topic: 'Exception Handling'
    },
    {
      id: 68,
      question: 'The Finally block runs:',
      options: ['Only on success', 'Only on failure', 'Always', 'Never automatically'],
      correctAnswer: 2,
      explanation: 'The Finally block is designed to ALWAYS execute — whether the Try block completed successfully, an exception was caught and handled, or even if a Rethrow/Throw occurs inside the Catch block.',
      difficulty: 'Easy',
      topic: 'Exception Handling'
    },
    {
      id: 69,
      question: 'Retry Scope is best suited for:',
      options: ['Business rule violations', 'Transient/system failures', 'Syntax errors', 'Compile errors'],
      correctAnswer: 1,
      explanation: 'Retry Scope is purpose-built for transient, timing-related failures where retrying has a reasonable chance of succeeding.',
      difficulty: 'Medium',
      topic: 'Exception Handling'
    },
    {
      id: 70,
      question: 'Which log level fits a successful transaction completion message?',
      options: ['Error', 'Fatal', 'Information', 'Trace'],
      correctAnswer: 2,
      explanation: 'Information level is intended for normal operational milestones that confirm expected progress, such as successful completion of a business transaction.',
      difficulty: 'Easy',
      topic: 'Logging'
    },
    {
      id: 71,
      question: 'Add Log Fields is used to:',
      options: ['Delete old logs', 'Attach shared metadata to subsequent log messages automatically', 'Change log file location', 'Encrypt logs'],
      correctAnswer: 1,
      explanation: 'Add Log Fields attaches specified key-value metadata (like TransactionID) to all Log Message activities executed within its scope automatically.',
      difficulty: 'Medium',
      topic: 'Logging'
    },
    {
      id: 72,
      question: 'Sensitive data like passwords should be:',
      options: ['Logged in full for audit', 'Never logged in plain text', 'Logged only in Debug mode', 'Logged only to Orchestrator'],
      correctAnswer: 1,
      explanation: 'Logging sensitive data such as plain-text passwords or full payment card numbers is a serious security/compliance risk and should always be avoided or masked.',
      difficulty: 'Easy',
      topic: 'Logging'
    },
    {
      id: 73,
      question: 'Computer Vision is especially useful for:',
      options: ['Native Windows desktop apps only', 'Citrix/virtual desktop environments', 'Console applications', 'Replacing all selectors universally'],
      correctAnswer: 1,
      explanation: 'Computer Vision is specifically designed to handle scenarios like Citrix and other virtualized/remote desktop environments where the underlying UI Automation tree isn\'t accessible to standard selector-based targeting.',
      difficulty: 'Medium',
      topic: 'UI Automation'
    },
    {
      id: 74,
      question: 'A Strict selector breaks when:',
      options: ['The element\'s attributes change slightly', 'Never', 'Only with Fuzzy targeting enabled', 'Only on Citrix'],
      correctAnswer: 0,
      explanation: 'Strict selectors require exact attribute matching, so any minor change to an attribute value causes the selector to fail entirely.',
      difficulty: 'Medium',
      topic: 'UI Automation'
    },
    {
      id: 75,
      question: 'Wait Element Vanish is used to:',
      options: ['Click an element', 'Wait until an element disappears', 'Extract text', 'Take a screenshot'],
      correctAnswer: 1,
      explanation: 'Wait Element Vanish is purpose-built to pause execution until a specified element (like a loading spinner) is no longer present.',
      difficulty: 'Easy',
      topic: 'UI Automation'
    },
    {
      id: 76,
      question: 'Object Repository hierarchy order is:',
      options: ['Element > Screen > Application', 'Application > Screen > Element', 'Screen > Element > Application', 'Project > Application > Screen'],
      correctAnswer: 1,
      explanation: 'The Object Repository organizes UI targets in the order Application (the top-level app being automated) → Screen (a specific page/window within that app) → Element (an individual UI control on that screen).',
      difficulty: 'Easy',
      topic: 'Object Repository'
    },
    {
      id: 77,
      question: 'A published Object Repository becomes a:',
      options: ['Template', 'UI Library', 'Queue', 'Asset'],
      correctAnswer: 1,
      explanation: 'Publishing an Object Repository packages it as a versioned UI Library, allowing reuse across multiple separate automation projects.',
      difficulty: 'Easy',
      topic: 'Object Repository'
    },
    {
      id: 78,
      question: 'Elements consumed from a published UI Library are:',
      options: ['Fully editable in the consuming project', 'Read-only in the consuming project', 'Automatically deleted', 'Converted to Image targets'],
      correctAnswer: 1,
      explanation: 'Once a UI Library is consumed as a dependency, its descriptors are read-only within the consuming project — this protects the integrity of the shared, versioned source.',
      difficulty: 'Hard',
      topic: 'Object Repository'
    },
    {
      id: 79,
      question: 'Dynamic descriptors in the Object Repository allow:',
      options: ['Only static matching', 'Parameterized/variable selector parts for runtime flexibility', 'Removal of all selectors', 'Only Computer Vision targeting'],
      correctAnswer: 1,
      explanation: 'The Object Repository fully supports dynamic descriptors — selector parts can be parameterized so a single reusable descriptor adapts to runtime values.',
      difficulty: 'Hard',
      topic: 'Object Repository'
    },
    {
      id: 80,
      question: 'A UI Library differs from a regular Library because it specifically packages:',
      options: ['Queue definitions', 'Object Repository UI element descriptors', 'Orchestrator assets', 'Test cases'],
      correctAnswer: 1,
      explanation: 'A UI Library packages Object Repository elements (Applications/Screens/Elements) for reuse across projects, while a regular Library packages reusable custom workflows/activities.',
      difficulty: 'Medium',
      topic: 'Object Repository'
    },
    {
      id: 81,
      question: 'Image automation should generally be used:',
      options: ['As the first choice always', 'As a last resort when no other targeting method works', 'Only with Fuzzy selectors', 'Only in Orchestrator'],
      correctAnswer: 1,
      explanation: 'Image automation should be a LAST resort — it\'s the most fragile targeting method, used mainly when no other method works.',
      difficulty: 'Easy',
      topic: 'UI Automation'
    },
    {
      id: 82,
      question: 'A Tracepoint differs from a Breakpoint because it:',
      options: ['Pauses execution', 'Logs without pausing execution', 'Deletes the activity', 'Only works in Release mode'],
      correctAnswer: 1,
      explanation: 'A Tracepoint logs information to the Output panel without halting execution; a Breakpoint halts execution when reached.',
      difficulty: 'Medium',
      topic: 'Debugging'
    },
    {
      id: 83,
      question: 'An unattended robot running on a server WITHOUT Microsoft Excel installed needs to read and write data to .xlsx files as fast as possible. Which approach is correct?',
      options: ['Use Excel Process Scope with Read Range/Write Range activities', 'Use the "Use Excel File" (Workbook) activities, which don\'t require Excel to be installed', 'This scenario is impossible without installing Excel', 'Use Image automation to simulate Excel manually'],
      correctAnswer: 1,
      explanation: 'Workbook activities (under "Use Excel File") read and write Excel file formats directly without requiring the Excel application to be installed, making them ideal for headless/unattended server environments.',
      difficulty: 'Easy',
      topic: 'Excel Automation'
    },
    {
      id: 84,
      question: 'A developer needs to refresh a Pivot Table and regenerate a Chart based on updated data. Which container activity is REQUIRED?',
      options: ['Use Excel File (Workbook)', 'Excel Process Scope', 'Read Range only', 'Either container works identically for this task'],
      correctAnswer: 1,
      explanation: 'Pivot Tables and Charts are Excel-application-level features that depend on Excel\'s actual calculation/rendering engine, so they require Excel Process Scope.',
      difficulty: 'Medium',
      topic: 'Excel Automation'
    },
    {
      id: 85,
      question: 'After using Remove Duplicates on a DataTable variable `dtData` that was read from an Excel file, what is true about the original Excel file?',
      options: ['It is automatically updated to remove the duplicate rows', 'It remains unchanged until the modified DataTable is explicitly written back (e.g., via Write Range)', 'Remove Duplicates directly deletes rows in the open Excel file in real time', 'The Excel file becomes corrupted'],
      correctAnswer: 1,
      explanation: 'Remove Duplicates operates entirely on the in-memory DataTable variable; it does not touch the source file. To persist the deduplicated data, the developer must explicitly write the modified DataTable back to the file.',
      difficulty: 'Medium',
      topic: 'Excel Automation'
    },
    {
      id: 86,
      question: 'Which activity should be used to add new rows of data to the END of an existing Excel range WITHOUT overwriting the current data?',
      options: ['Write Range', 'Write Cell', 'Append Range', 'Copy/Paste Range'],
      correctAnswer: 2,
      explanation: 'Append Range is specifically designed to add a DataTable\'s rows after the last existing row of data, preserving what\'s already there.',
      difficulty: 'Easy',
      topic: 'Excel Automation'
    },
    {
      id: 87,
      question: 'Which protocol is used specifically to SEND email, as opposed to retrieving it?',
      options: ['IMAP', 'POP3', 'SMTP', 'FTP'],
      correctAnswer: 2,
      explanation: 'SMTP (Simple Mail Transfer Protocol) is the standard protocol for sending outgoing email. IMAP and POP3 are both protocols for RETRIEVING email from a server.',
      difficulty: 'Easy',
      topic: 'Email Automation'
    },
    {
      id: 88,
      question: 'An unattended robot on a lightweight server (without Outlook installed) needs to read and send corporate email via Microsoft 365. What is the BEST approach?',
      options: ['Use Outlook desktop activities, since they\'re the only way to interact with Microsoft email', 'Use Microsoft 365/Graph-based activities (or the Integration Service M365 connector), which don\'t require a local Outlook installation', 'Install Outlook on every unattended robot machine as a workaround', 'Use Gmail activities instead, since they\'re protocol-agnostic'],
      correctAnswer: 1,
      explanation: 'Microsoft 365 (Graph API-based) activities or the Integration Service connector authenticate via OAuth against Microsoft\'s cloud services directly, without requiring a locally installed and configured Outlook client.',
      difficulty: 'Medium',
      topic: 'Email Automation'
    },
    {
      id: 89,
      question: 'What is a key behavioral difference between IMAP and POP3 relevant to automation design?',
      options: ['IMAP only works with Gmail; POP3 only works with Outlook', 'IMAP keeps emails synced on the server (read/unread state preserved across clients); POP3 traditionally downloads and may remove messages from the server', 'POP3 is used only for sending; IMAP only for receiving', 'There is no meaningful difference for automation purposes'],
      correctAnswer: 1,
      explanation: 'IMAP maintains server-side state (read/unread, folder structure) synchronized across multiple clients, making it well suited for automation that needs consistent, repeatable access to the mailbox state.',
      difficulty: 'Medium',
      topic: 'Email Automation'
    },
    {
      id: 90,
      question: 'A PDF invoice is a scanned image with no embedded, selectable text. What must be used to extract its text content?',
      options: ['Read PDF Text alone, without any additional configuration', 'OCR (Optical Character Recognition), since there is no native text layer to extract directly', 'DataTable.Select()', 'Regex Builder alone, without any text extraction first'],
      correctAnswer: 1,
      explanation: 'Since a scanned PDF has no embedded text layer — it\'s purely a pixel image — text must first be recognized via OCR before any further string processing can be applied to it.',
      difficulty: 'Easy',
      topic: 'PDF Automation'
    },
    {
      id: 91,
      question: 'A developer extracts text from a PDF that appears normal on screen (text looks selectable), but the extracted string output is garbled/nonsensical. What is the MOST likely cause and fix?',
      options: ['The PDF is corrupted beyond use; no fix is possible', 'The PDF\'s embedded text layer is broken/mismatched despite appearing visually normal; falling back to OCR-based extraction is the appropriate fix', 'The Read PDF Text activity is fundamentally broken and should never be used', 'Increase the Timeout property to fix garbled text'],
      correctAnswer: 1,
      explanation: 'Some PDFs have a corrupted or improperly mapped text layer where the visual rendering looks fine but the underlying extractable text doesn\'t correspond correctly — in these cases, falling back to OCR often produces more reliable results.',
      difficulty: 'Hard',
      topic: 'PDF Automation'
    },
    {
      id: 92,
      question: 'An invoice PDF contains a variable number of line-item rows (sometimes 3, sometimes 30). What extraction approach is MOST appropriate for this repeating, variable-length data?',
      options: ['Hard-code fixed cell coordinates for exactly 3 rows every time', 'Use table/structured (multiple) extraction capabilities, such as Document Understanding, designed to handle variable-length repeating data', 'Manually copy-paste the data each time', 'Use only Get Text on a fixed, single bounding box regardless of row count'],
      correctAnswer: 1,
      explanation: 'Variable-length repeating data (like line items) is the classic use case for table/structured "multiple" extraction approaches such as Document Understanding.',
      difficulty: 'Medium',
      topic: 'PDF Automation'
    },
    {
      id: 93,
      question: 'A developer wants to process only PDF files within a folder, including PDFs in any subfolders. Which configuration is correct for "For Each File in Folder"?',
      options: ['Search pattern `*.pdf`, with the folder scope set to include subfolders (all directories)', 'Search pattern `*.*`, top directory only', 'Search pattern `pdf`, no subfolder option needed', 'This requires a separate activity for each subfolder'],
      correctAnswer: 0,
      explanation: 'Setting the search pattern to `*.pdf` filters to only PDF files, and configuring the activity to traverse all directories ensures subfolder contents are included.',
      difficulty: 'Medium',
      topic: 'Files and Folders'
    },
    {
      id: 94,
      question: 'Before deleting a file by path, what is the recommended best practice?',
      options: ['Just attempt the delete and catch any resulting exception', 'Check that the file exists first (e.g., via Path Exists or File.Exists), to avoid unnecessary exceptions and support safe re-runs', 'Always rename the file first', 'Delete is inherently safe and never throws exceptions on a missing file'],
      correctAnswer: 1,
      explanation: 'Validating existence before deleting avoids triggering avoidable exceptions and makes the automation idempotent — safe to re-run without failing if the target was already removed in a prior run.',
      difficulty: 'Easy',
      topic: 'Files and Folders'
    },
    {
      id: 95,
      question: 'Which collection type should be used when the number of items is unknown at design time and items will be added/removed dynamically during execution?',
      options: ['Array', 'List(Of T)', 'DataTable', 'String'],
      correctAnswer: 1,
      explanation: 'List(Of T) is dynamically resizable, supporting `.Add()` and `.Remove()` at runtime, making it the correct choice when the final item count isn\'t known upfront.',
      difficulty: 'Easy',
      topic: 'Data Manipulation'
    },
    {
      id: 96,
      question: 'A developer needs to convert a user-provided string into an Integer but isn\'t sure if the input will always be a valid number. What is the BEST practice?',
      options: ['Use `CInt(input)` directly without any error handling', 'Use `Integer.TryParse(input, result)`, which returns a Boolean indicating success instead of throwing an exception on invalid input', 'Use `Integer.Parse(input)` wrapped only in a Comment activity', 'Always assume the input is valid and skip validation entirely'],
      correctAnswer: 1,
      explanation: 'TryParse is the robust choice for uncertain input: it attempts the conversion and returns a Boolean success flag, avoiding an unhandled exception when the input is invalid.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 97,
      question: 'What does `dt.Select("Amount > 1000")` return?',
      options: ['A new filtered DataTable', 'An array of DataRow objects matching the filter', 'A Boolean indicating whether any row matches', 'A List(Of Decimal) of matching amounts'],
      correctAnswer: 1,
      explanation: 'DataTable.Select(filterExpression) returns a `DataRow()` array containing the rows that satisfy the filter condition — it does NOT return a new DataTable.',
      difficulty: 'Hard',
      topic: 'Data Manipulation'
    },
    {
      id: 98,
      question: 'A developer needs to extract ALL phone numbers (not just the first one) found in a block of text using Regex. Which approach is correct?',
      options: ['Regex.Match(text, pattern).Value, since Match returns all occurrences', 'Regex.Matches(text, pattern), which returns a MatchCollection containing all matches found in the text', 'Regex.Replace(text, pattern, "")', 'Regex.IsMatch(text, pattern)'],
      correctAnswer: 1,
      explanation: 'Regex.Matches (plural) returns a MatchCollection containing ALL non-overlapping matches found in the input text. Regex.Match (singular) returns only the FIRST match.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 99,
      question: 'Which data structure is MOST appropriate for storing a configuration mapping of country codes to country names (e.g., "US" → "United States", "FR" → "France"), where lookups by code are frequent?',
      options: ['DataTable', 'Array', 'Dictionary(Of String, String)', 'List(Of String)'],
      correctAnswer: 2,
      explanation: 'A Dictionary(Of TKey, TValue) is purpose-built for fast key-based lookups, exactly matching the use case of mapping a unique code (key) to a corresponding name (value).',
      difficulty: 'Easy',
      topic: 'Data Manipulation'
    },
    {
      id: 100,
      question: 'What is the result of `"  Hello World  ".Trim().Split(" "c)(1)`?',
      options: ['" Hello"', '"World"', '"Hello"', 'An IndexOutOfRangeException'],
      correctAnswer: 1,
      explanation: 'First, `.Trim()` removes the leading/trailing spaces, producing `"Hello World"`. Then `.Split(" "c)` splits on the space character, producing an array `{"Hello", "World"}`. Index `(1)` (zero-based) retrieves the SECOND element, `"World"`.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 101,
      question: 'Which Excel activity type does NOT require Excel to be installed on the robot machine?',
      options: ['Excel Process Scope', 'Pivot Table activities', 'Workbook (Use Excel File) activities', 'Chart activities'],
      correctAnswer: 2,
      explanation: 'The modern Workbook/"Use Excel File" activities work directly with the .xlsx file and run even when Excel isn\'t installed — a key advantage over the legacy Excel Application Scope.',
      difficulty: 'Medium',
      topic: 'Excel Automation'
    },
    {
      id: 102,
      question: 'Building or refreshing Pivot Tables and Charts in a workbook requires which container?',
      options: ['Excel Process Scope', 'Workbook activities only', 'No container at all', 'An Orchestrator asset'],
      correctAnswer: 0,
      explanation: 'Pivot Tables and Charts depend on the real Excel engine, so they must run inside an Excel Process Scope.',
      difficulty: 'Easy',
      topic: 'Excel Automation'
    },
    {
      id: 103,
      question: 'What does the Append Range activity do?',
      options: ['Overwrites all existing data starting from cell A1', 'Deletes existing rows before writing', 'Adds new rows after the last used row, without overwriting existing data', 'Creates a brand-new workbook file'],
      correctAnswer: 2,
      explanation: 'Append Range writes a DataTable right after the last row with data, preserving what\'s already in the sheet — ideal for building a running log.',
      difficulty: 'Easy',
      topic: 'Excel Automation'
    },
    {
      id: 104,
      question: 'Which email protocol is used specifically for SENDING email?',
      options: ['IMAP', 'POP3', 'SMTP', 'FTP'],
      correctAnswer: 2,
      explanation: 'SMTP is the standard protocol for sending/relaying outgoing mail, used by "Send SMTP Mail Message."',
      difficulty: 'Easy',
      topic: 'Email Automation'
    },
    {
      id: 105,
      question: 'What is the key difference between IMAP and POP3 when retrieving email?',
      options: ['IMAP can only send mail, never receive it', 'IMAP keeps the mailbox synced and managed on the server across multiple clients; POP3 typically downloads and removes messages locally', 'IMAP cannot filter or search messages', 'IMAP requires Outlook to be installed, POP3 does not'],
      correctAnswer: 1,
      explanation: 'IMAP synchronizes mailbox state server-side, so folders and read status stay consistent across devices. POP3 classically downloads messages to one client and can remove them from the server.',
      difficulty: 'Medium',
      topic: 'Email Automation'
    },
    {
      id: 106,
      question: 'What is required to use the Outlook DESKTOP-specific activities (vs. the protocol-based Email activities)?',
      options: ['Nothing — they work without any local setup', 'Only an internet connection', 'A Gmail account', 'Outlook must be installed and configured (with a mail profile) on the robot\'s machine'],
      correctAnswer: 3,
      explanation: 'Outlook-specific activities automate the actual desktop application via its object model, so Outlook must be installed with a configured profile.',
      difficulty: 'Medium',
      topic: 'Email Automation'
    },
    {
      id: 107,
      question: 'A robot must read text from a scanned PDF with no embedded text layer. What must be used?',
      options: ['Direct text extraction (Read PDF Text)', 'OCR (Optical Character Recognition)', 'Regex applied directly to the PDF file', 'Excel activities'],
      correctAnswer: 1,
      explanation: 'A scanned PDF is essentially an image, so direct text-extraction returns nothing useful. OCR engines convert visible characters in the image into machine-readable text.',
      difficulty: 'Easy',
      topic: 'PDF Automation'
    },
    {
      id: 108,
      question: 'A PDF\'s invoice line-items table has a varying row count per document. What is the MOST robust extraction approach across many documents?',
      options: ['Fixed coordinate/anchor extraction tuned to one layout', 'Manual copy-paste per document', 'Document Understanding with table extraction (ML-based or trainable extractors)', 'Image automation (click/type only)'],
      correctAnswer: 2,
      explanation: 'Document Understanding is built for variable-length tables across differing layouts. Fixed coordinates break when layout or row count changes.',
      difficulty: 'Medium',
      topic: 'PDF Automation'
    },
    {
      id: 109,
      question: 'Before deleting a file in a workflow, what is the recommended practice?',
      options: ['Delete it immediately, no checks', 'Rename the file twice for safety', 'Convert the file to PDF first', 'Check that the file exists first (e.g., File.Exists) to avoid an exception'],
      correctAnswer: 3,
      explanation: 'Deleting a non-existent file throws an exception. Checking existence first (or wrapping in proper exception handling) keeps the automation robust.',
      difficulty: 'Easy',
      topic: 'Files and Folders'
    },
    {
      id: 110,
      question: 'In "For Each File in Folder," what does the recursive/search-option setting control?',
      options: ['Which file extensions are filtered', 'The text encoding used to read each file', 'Whether files inside subfolders are included, not just the top-level folder', 'The maximum allowed file size'],
      correctAnswer: 2,
      explanation: 'This setting determines whether enumeration descends into subfolders or stays at the top level only.',
      difficulty: 'Easy',
      topic: 'Files and Folders'
    },
    {
      id: 111,
      question: 'What is true about a standard Array\'s size once created?',
      options: ['It is dynamic and resizable anytime via .Add()', 'It is fixed at creation; growing it requires creating a new array (e.g., Array.Resize)', 'It is always zero regardless of contents', 'It is unlimited and grows automatically'],
      correctAnswer: 1,
      explanation: 'A standard Array has a fixed size; growing it means allocating a new array and copying elements. This is exactly why List(Of T) is preferred when the element count isn\'t known up front.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 112,
      question: 'Why is TryParse generally preferred over Parse for converting external string input to a number?',
      options: ['TryParse is always faster regardless of input', 'TryParse only works with strings, while Parse works with any type', 'TryParse returns a Boolean success/failure flag instead of throwing on invalid input', 'TryParse automatically changes the variable\'s declared type'],
      correctAnswer: 2,
      explanation: 'TryParse returns True/False and places the result in an output parameter, so invalid input is handled gracefully without an exception.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 113,
      question: 'What does `dt.Select("filter expression")` return?',
      options: ['A new DataTable object', 'A DataRow array (DataRow()) matching the filter, still referencing the original DataTable', 'A Boolean indicating whether any rows matched', 'A List(Of String) of column names'],
      correctAnswer: 1,
      explanation: 'Select() returns DataRow objects, NOT a new DataTable — a classic exam trap. To get an actual filtered DataTable, combine it with CopyToDataTable().',
      difficulty: 'Hard',
      topic: 'Data Manipulation'
    },
    {
      id: 114,
      question: 'What does `Regex.Matches(text, pattern)` (plural) return?',
      options: ['Only the first match found', 'A MatchCollection containing every non-overlapping match in the text', 'A single Boolean value', 'Nothing — invalid syntax'],
      correctAnswer: 1,
      explanation: 'Regex.Matches returns ALL matches as a MatchCollection. Regex.Match (singular) returns only the first match.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 115,
      question: 'A Dictionary(Of TKey, TValue) is best suited for:',
      options: ['Multi-column tabular data with many rows', 'Fast key-based lookups, e.g., mapping a unique code to a value', 'Strictly ordered, index-only sequential lists', 'Storing raw binary file content'],
      correctAnswer: 1,
      explanation: 'Dictionary stores unique key→value pairs optimized for lookups by key. Tabular data fits a DataTable better.',
      difficulty: 'Easy',
      topic: 'Data Manipulation'
    },
    {
      id: 116,
      question: 'What does `dt.AsEnumerable().Where(...).CopyToDataTable()` accomplish?',
      options: ['Permanently deletes the original DataTable', 'Produces a new, separate DataTable containing only rows that satisfy the LINQ filter', 'Converts the DataTable into a Dictionary', 'Exports the DataTable directly to Excel'],
      correctAnswer: 1,
      explanation: 'AsEnumerable() exposes rows as queryable, Where() filters, and CopyToDataTable() materializes the filtered rows into a real new DataTable.',
      difficulty: 'Hard',
      topic: 'Data Manipulation'
    },
    {
      id: 117,
      question: 'How does `String.IsNullOrWhiteSpace()` differ from `String.IsNullOrEmpty()`?',
      options: ['It additionally checks whether the string is numeric', 'It additionally treats whitespace-only strings (spaces, tabs) as "empty," not just null/zero-length', 'It converts the string to uppercase before comparing', 'It strips punctuation before comparing'],
      correctAnswer: 1,
      explanation: 'IsNullOrEmpty only catches null or "" — a string like "   " would pass as "not empty." IsNullOrWhiteSpace also catches whitespace-only strings.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 118,
      question: 'What is the Read Text File activity used for?',
      options: ['Reading .xlsx Excel workbook content', 'Reading the raw text content of a plain text file (.txt, .log, etc.)', 'Reading the visual content of a PDF page', 'Reading messages from an Outlook mailbox'],
      correctAnswer: 1,
      explanation: 'Read Text File reads an entire plain-text file into a string. Excel, PDF, and mail content need different specific activities.',
      difficulty: 'Easy',
      topic: 'Files and Folders'
    },
    {
      id: 119,
      question: 'Which operations does a List(Of T) support natively that a fixed-size Array does NOT, without recreating it?',
      options: ['Indexing elements by position', '.Add() and .Remove() to dynamically grow/shrink the collection', 'Reading the collection\'s element count', 'Sorting the collection\'s elements'],
      correctAnswer: 1,
      explanation: 'List(Of T) can grow/shrink in place via .Add()/.Remove(). An Array can be indexed, has a .Length, and can be sorted just like a List — but it can\'t add/remove elements without reallocating.',
      difficulty: 'Medium',
      topic: 'Data Manipulation'
    },
    {
      id: 120,
      question: 'When is Excel Process Scope the BEST choice over the lightweight Workbook activities?',
      options: ['When Excel is not installed on the machine', 'When live formulas, macros, pivot tables, or charts need to be created/refreshed via the actual Excel engine', 'When maximum headless performance with no Excel dependency is required', 'When only reading a raw CSV file'],
      correctAnswer: 1,
      explanation: 'Excel Process Scope opens a real Excel instance, needed for engine-specific features like macros, pivot tables, and charts.',
      difficulty: 'Medium',
      topic: 'Excel Automation'
    },
    {
      id: 121,
      question: 'What is the main risk of hard-coding a fixed Delay (e.g., 5000ms) instead of using a dynamic wait condition (e.g., Element Exists / Check App State)?',
      options: ['Hard-coded delays are illegal under UiPath\'s licensing terms', 'The robot either wastes time waiting longer than necessary, or fails because the wait wasn\'t long enough on a slower run', 'Hard-coded delays cannot be used inside Sequences', 'Hard-coded delays automatically trigger an SLA breach in Orchestrator'],
      correctAnswer: 1,
      explanation: 'A fixed delay assumes constant system response time, which rarely holds — under load, the target app may take longer than the delay (causing failure), while on a fast run the robot idles needlessly. Dynamic waits instead poll for an actual condition.',
      difficulty: 'Medium',
      topic: 'Control Flow'
    },
    {
      id: 122,
      question: 'In REFramework, which state retrieves the next transaction item (e.g., dequeues a queue item) and checks whether one was found?',
      options: ['Init', 'Get Transaction Data', 'Process', 'End Process'],
      correctAnswer: 1,
      explanation: 'Get Transaction Data pulls the next item and checks if one remains; if not, the framework proceeds to End Process.',
      difficulty: 'Medium',
      topic: 'Orchestrator'
    },
    {
      id: 123,
      question: 'A developer needs to store a secret API key without hard-coding it or exposing it in plain-text logs. What is the BEST mechanism?',
      options: ['A plain Orchestrator Asset of type Text', 'A cell in a Config.xlsx file', 'An Orchestrator Credential asset (or external Credential Store/vault integration)', 'A hard-coded String variable in the workflow'],
      correctAnswer: 2,
      explanation: 'Credential-type assets (or an integrated vault like CyberArk/Azure Key Vault) store secrets securely and retrieve them only at runtime.',
      difficulty: 'Medium',
      topic: 'Orchestrator'
    },
    {
      id: 124,
      question: 'What is the key difference between a Sequence and a Flowchart in Studio?',
      options: ['Sequences support loops while Flowcharts do not', 'Sequences suit linear, top-to-bottom logic; Flowcharts suit complex branching logic with multiple decision paths', 'Flowcharts cannot contain Invoke Workflow File activities', 'Sequences can only contain a maximum of 5 activities'],
      correctAnswer: 1,
      explanation: 'A Sequence runs activities top-to-bottom and suits straightforward logic. A Flowchart connects activities with multiple branches, making complex decision trees easier to visualize.',
      difficulty: 'Easy',
      topic: 'Control Flow'
    },
    {
      id: 125,
      question: 'Which construct guarantees a resource is released whether or not an exception occurred?',
      options: ['The Catch block only', 'The Finally block (within Try Catch)', 'A Throw activity', 'A Rethrow activity'],
      correctAnswer: 1,
      explanation: 'Activities in Finally always run — whether Try succeeded, threw a caught exception, or threw uncaught — making it right for mandatory cleanup.',
      difficulty: 'Medium',
      topic: 'Exception Handling'
    },
    {
      id: 126,
      question: 'A queue item keeps failing due to invalid source data (e.g., a missing required field). How should the workflow report this so Orchestrator does NOT auto-retry?',
      options: ['Throw a System Exception', 'Throw (or have REFramework catch and report) a Business Exception', 'Log a message and continue silently', 'Restart the entire job'],
      correctAnswer: 1,
      explanation: 'Business Exceptions mark predictable, data-related failures that won\'t be fixed by retrying, and they do NOT trigger Orchestrator\'s automatic retry.',
      difficulty: 'Hard',
      topic: 'Exception Handling'
    },
    {
      id: 127,
      question: 'What does REFramework\'s "Reinitialize on every X transactions" setting help prevent?',
      options: ['Robot license expiration', 'Gradual resource degradation (memory bloat, stuck app state) from running huge volumes without ever restarting the target application', 'Orchestrator downtime', 'Queue item duplication'],
      correctAnswer: 1,
      explanation: 'Long unattended runs through the same open app session can accumulate memory leaks or get the app into a degraded state. Periodically returning to Init to relaunch applications refreshes the environment for long-run stability.',
      difficulty: 'Hard',
      topic: 'Orchestrator'
    },
    {
      id: 128,
      question: 'Which approach is MOST appropriate for reliably extracting structured fields from invoices arriving in many different vendor layouts?',
      options: ['Hard-coded Regex patterns per known vendor only', 'Document Understanding (ML/Generative extractors + Validation Station/Action Center for human review)', 'Screen scraping with Image automation activities', 'Manually typing values into a spreadsheet'],
      correctAnswer: 1,
      explanation: 'Document Understanding classifies documents and extracts fields across varying layouts using ML/Generative Extractors, routing low-confidence results to a human via Validation Station/Action Center.',
      difficulty: 'Medium',
      topic: 'Document Understanding'
    },
    {
      id: 129,
      question: 'What is the primary benefit of an Orchestrator Queue over looping an in-memory DataTable in a single workflow run?',
      options: ['Queues only work with attended robots', 'Queues persist items centrally, support distributed processing across multiple robots, automatic retries, and survive job/robot restarts', 'Queues replace the need for any Get Transaction Data logic', 'Queues can only hold a maximum of 10 items'],
      correctAnswer: 1,
      explanation: 'Queues store items persistently, so a crashed robot/job doesn\'t lose unprocessed items, multiple robots can pull from the same queue for scale, and failed items can auto-retry per configuration.',
      difficulty: 'Medium',
      topic: 'Orchestrator'
    },
    {
      id: 130,
      question: 'How do a project-level Global Exception Handler and a local Try Catch differ?',
      options: ['They serve the exact same purpose and one always replaces the other', 'The Global Exception Handler is a project-wide safety net for otherwise unhandled exceptions, while local Try Catch handles expected, specific failure points with targeted recovery', 'Global Exception Handlers only work with attended automations', 'Local Try Catch blocks are deprecated in favor of Global Exception Handlers'],
      correctAnswer: 1,
      explanation: 'A Global Exception Handler catches/logs unexpected exceptions anywhere in the project as a final safety net. Local Try Catch remains the right tool for anticipated failure points needing immediate, targeted recovery. The two complement each other.',
      difficulty: 'Hard',
      topic: 'Exception Handling'
    },
    {
      id: 131,
      question: 'Which version control system is primarily integrated with UiPath Studio for collaborative development?',
      options: ['Subversion (SVN)', 'Git', 'Mercurial', 'Perforce'],
      correctAnswer: 1,
      explanation: 'Git is the primary version control system integrated with UiPath Studio. It enables teams to collaborate on projects, manage branches, and maintain version history.',
      difficulty: 'Easy',
      topic: 'Version Control integration'
    },
    {
      id: 132,
      question: 'When committing a workflow to version control in UiPath, what should be included in the commit message?',
      options: ['Only the workflow name', 'Detailed description of changes made', 'The developer ID only', 'The project GUID'],
      correctAnswer: 1,
      explanation: 'Commit messages should include a detailed description of the changes made to the workflow. This helps team members understand what modifications were made and why.',
      difficulty: 'Medium',
      topic: 'Version Control integration'
    },
    {
      id: 133,
      question: 'What is the purpose of branching in version control for UiPath projects?',
      options: ['To increase code complexity', 'To isolate development work and enable parallel development', 'To slow down deployment', 'To replace testing procedures'],
      correctAnswer: 1,
      explanation: 'Branching allows developers to work on features or fixes independently without affecting the main codebase. This enables parallel development and safer integration.',
      difficulty: 'Medium',
      topic: 'Version Control integration'
    },
    {
      id: 134,
      question: 'Which file should typically be excluded from version control in a UiPath project?',
      options: ['project.json', '.gitignore', 'bin/ and obj/ directories', 'All UiPath files'],
      correctAnswer: 2,
      explanation: 'The bin/ and obj/ directories contain build artifacts and should be excluded from version control using .gitignore. These are regenerated during builds and should not be tracked.',
      difficulty: 'Hard',
      topic: 'Version Control integration'
    },
    {
      id: 135,
      question: 'What is a merge conflict in UiPath version control, and how should it be resolved?',
      options: ['A conflict between two branches that need manual intervention to resolve', 'An error that cannot be fixed', 'A security issue in the repository', 'A performance problem in workflows'],
      correctAnswer: 0,
      explanation: 'A merge conflict occurs when changes from different branches contradict each other. Developers must manually review and resolve these conflicts before completing the merge.',
      difficulty: 'Hard',
      topic: 'Version Control integration'
    },
    {
      id: 136,
      question: 'What is a UiPath Library, and what is its primary purpose?',
      options: ['A backup system for workflows', 'A reusable collection of activities and workflows that can be published and consumed by other projects', 'A database for storing credentials', 'A tool for monitoring job execution'],
      correctAnswer: 1,
      explanation: 'A UiPath Library is a collection of reusable activities and workflows that can be packaged, published to Orchestrator, and consumed by other projects to promote code reusability.',
      difficulty: 'Easy',
      topic: 'Libraries and Templates'
    },
    {
      id: 137,
      question: 'How are custom activities typically created in UiPath Libraries?',
      options: ['By recording user actions', 'By writing C# code in a Visual Studio project and wrapping it as a UiPath activity', 'By combining built-in activities in Notepad', 'By using the Orchestrator API only'],
      correctAnswer: 1,
      explanation: 'Custom activities are created by developing C# code in Visual Studio, then packaging it as a UiPath activity. This allows developers to extend UiPath functionality with custom logic.',
      difficulty: 'Hard',
      topic: 'Libraries and Templates'
    },
    {
      id: 138,
      question: 'What is the benefit of using UiPath Project Templates?',
      options: ['Templates guarantee 100% automation success', 'Templates provide standardized project structure and predefined workflows for common scenarios', 'Templates eliminate the need for testing', 'Templates can only be used once'],
      correctAnswer: 1,
      explanation: 'Project templates provide standardized structure, best practices, and predefined workflows for common RPA scenarios, enabling faster development and consistency across projects.',
      difficulty: 'Easy',
      topic: 'Libraries and Templates'
    },
    {
      id: 139,
      question: 'When publishing a Library to Orchestrator, what must be versioned?',
      options: ['Only the library name', 'The library package with a specific version number (e.g., 1.0.0)', 'Nothing, versioning is not needed', 'The entire Orchestrator database'],
      correctAnswer: 1,
      explanation: 'When publishing libraries to Orchestrator, versioning is critical. Each published version should follow semantic versioning (e.g., 1.0.0) to track changes and manage dependencies.',
      difficulty: 'Medium',
      topic: 'Libraries and Templates'
    },
    {
      id: 140,
      question: 'What is the difference between a library and a template in UiPath?',
      options: ['There is no difference', 'Libraries are reusable activities; templates are project skeletons with predefined structure', 'Libraries are only for beginners; templates are for experts', 'Templates cannot be modified'],
      correctAnswer: 1,
      explanation: 'Libraries are packages of reusable activities and workflows for consumption, while templates are pre-built project structures that serve as starting points for new projects.',
      difficulty: 'Medium',
      topic: 'Libraries and Templates'
    },
    {
      id: 141,
      question: 'What is the primary purpose of the UiPath Workflow Analyzer?',
      options: ['To delete unwanted workflows', 'To analyze workflows for performance and best practice violations', 'To replace manual testing', 'To compile workflows into executables'],
      correctAnswer: 1,
      explanation: 'The Workflow Analyzer is a code quality tool that scans workflows for violations of best practices, performance issues, and potential bugs, helping developers improve code quality.',
      difficulty: 'Easy',
      topic: 'Workflow Analyzer'
    },
    {
      id: 142,
      question: 'Which of the following is NOT a typical rule checked by the UiPath Workflow Analyzer?',
      options: ['Unused variables and imports', 'Missing descriptions in activities', 'User login credentials', 'Infinite loops in sequences'],
      correctAnswer: 2,
      explanation: 'The Workflow Analyzer checks for code quality issues, unused elements, and logic problems. It does not check for user login credentials as this is a security concern.',
      difficulty: 'Medium',
      topic: 'Workflow Analyzer'
    },
    {
      id: 143,
      question: 'How can developers suppress Workflow Analyzer warnings for specific activities?',
      options: ['By deleting the warning', 'By adding a suppression attribute or configuration to the activity', 'By renaming the activity', 'By exporting the workflow to Excel'],
      correctAnswer: 1,
      explanation: 'Developers can suppress specific Workflow Analyzer warnings by adding suppression attributes to activities or configuring rules in the project settings.',
      difficulty: 'Hard',
      topic: 'Workflow Analyzer'
    },
    {
      id: 144,
      question: 'What is the impact of unresolved Workflow Analyzer violations on project deployment?',
      options: ['Violations prevent deployment to Orchestrator', 'Violations are warnings that don\'t prevent deployment but indicate potential issues', 'Violations improve deployment performance', 'Violations only affect local execution'],
      correctAnswer: 1,
      explanation: 'Workflow Analyzer violations are typically warnings that don\'t block deployment but indicate code quality or best practice issues that should be addressed for robustness.',
      difficulty: 'Medium',
      topic: 'Workflow Analyzer'
    },
    {
      id: 145,
      question: 'What are the main phases in the UiPath Implementation Methodology?',
      options: ['Only coding and testing', 'Planning, Scope, Design, Development, Testing, and Deployment', 'Design and deployment only', 'Documentation and training only'],
      correctAnswer: 1,
      explanation: 'The UiPath implementation methodology follows structured phases: Planning, Scoping, Design, Development, Testing, and Deployment to ensure successful RPA projects.',
      difficulty: 'Easy',
      topic: 'Implementation Methodology'
    },
    {
      id: 146,
      question: 'During the Scoping phase of RPA implementation, what is the primary focus?',
      options: ['Writing all automation code', 'Identifying high-value automation opportunities and defining project boundaries', 'Deploying to production', 'Training end users only'],
      correctAnswer: 1,
      explanation: 'The Scoping phase focuses on identifying suitable automation candidates, assessing feasibility, defining project boundaries, and selecting processes that provide the highest ROI.',
      difficulty: 'Medium',
      topic: 'Implementation Methodology'
    },
    {
      id: 147,
      question: 'What is the purpose of the Design phase in UiPath Implementation Methodology?',
      options: ['To begin coding immediately', 'To create technical specifications, architecture, and detailed process flows', 'To deploy to production', 'To skip planning'],
      correctAnswer: 1,
      explanation: 'The Design phase involves creating comprehensive technical specifications, architecture diagrams, and detailed process flows that guide development and ensure alignment with requirements.',
      difficulty: 'Medium',
      topic: 'Implementation Methodology'
    },
    {
      id: 148,
      question: 'What is a critical success factor for RPA implementation projects?',
      options: ['Avoiding testing', 'Stakeholder engagement and clear communication throughout all phases', 'Minimizing documentation', 'Rushing to production deployment'],
      correctAnswer: 1,
      explanation: 'Stakeholder engagement, clear communication, and alignment across business and IT teams are critical success factors that ensure project objectives are met and changes are managed effectively.',
      difficulty: 'Hard',
      topic: 'Implementation Methodology'
    },
    {
      id: 149,
      question: 'What is the primary objective of RPA testing?',
      options: ['To slow down the development process', 'To verify that automated workflows execute correctly, handle exceptions, and meet business requirements', 'To eliminate the need for user acceptance testing', 'To replace manual testing entirely'],
      correctAnswer: 1,
      explanation: 'RPA testing verifies that workflows execute correctly, handle edge cases and exceptions, meet functional requirements, and perform efficiently before production deployment.',
      difficulty: 'Easy',
      topic: 'RPA Testing'
    },
    {
      id: 150,
      question: 'Which type of testing focuses on verifying individual activities and logic within a workflow?',
      options: ['System testing', 'Unit testing', 'User acceptance testing', 'Load testing'],
      correctAnswer: 1,
      explanation: 'Unit testing involves testing individual components and activities in isolation to verify that each part functions correctly before integration with other workflows.',
      difficulty: 'Medium',
      topic: 'RPA Testing'
    },
    {
      id: 151,
      question: 'What should be included in an RPA test case?',
      options: ['Only the test name', 'Test data, expected output, preconditions, and verification steps', 'Random inputs', 'No documentation'],
      correctAnswer: 1,
      explanation: 'Comprehensive test cases include preconditions, test data, step-by-step actions, expected outputs, and verification steps to ensure thorough testing of workflows.',
      difficulty: 'Medium',
      topic: 'RPA Testing'
    },
    {
      id: 152,
      question: 'How should error handling be tested in RPA workflows?',
      options: ['Errors should be ignored in testing', 'By deliberately introducing error conditions and verifying the workflow handles them gracefully', 'Errors cannot be tested', 'Only in production'],
      correctAnswer: 1,
      explanation: 'Testing error handling involves creating scenarios that trigger exceptions and verifying that workflows handle errors appropriately through retry logic, logging, or graceful termination.',
      difficulty: 'Hard',
      topic: 'RPA Testing'
    },
    {
      id: 153,
      question: 'What is User Acceptance Testing (UAT) in the context of RPA projects?',
      options: ['Testing performed only by developers', 'Testing performed by business stakeholders to verify the automated solution meets business requirements', 'Testing that happens only in production', 'Testing that can be skipped'],
      correctAnswer: 1,
      explanation: 'UAT involves business stakeholders and end users testing the RPA solution in a controlled environment to confirm it meets functional requirements and business expectations.',
      difficulty: 'Medium',
      topic: 'RPA Testing'
    },
    {
      id: 154,
      question: 'What is the primary role of the UiPath Orchestrator Integration Service?',
      options: ['To replace UiPath Studio', 'To provide APIs and services for integrating external systems with Orchestrator', 'To eliminate the need for workflows', 'To serve as a backup system only'],
      correctAnswer: 1,
      explanation: 'The Integration Service provides REST APIs and webhook capabilities that allow external systems and applications to communicate with UiPath Orchestrator for job execution and data exchange.',
      difficulty: 'Easy',
      topic: 'Integration Service'
    },
    {
      id: 155,
      question: 'How can external applications trigger UiPath job execution using the Integration Service?',
      options: ['They cannot', 'By making REST API calls to Orchestrator with appropriate credentials and job parameters', 'By modifying the Orchestrator database directly', 'By editing workflow files directly'],
      correctAnswer: 1,
      explanation: 'External applications can call Orchestrator REST APIs with valid authentication and parameters to start jobs, retrieve job status, and receive results through the Integration Service.',
      difficulty: 'Medium',
      topic: 'Integration Service'
    },
    {
      id: 156,
      question: 'What security considerations are important when using the Integration Service?',
      options: ['Security is not relevant', 'API authentication, encryption of credentials, role-based access control, and secure API key management', 'Disabling all security features', 'Hardcoding credentials in workflows'],
      correctAnswer: 1,
      explanation: 'Integration Service security requires API authentication tokens, HTTPS encryption, proper role-based access control, secure credential storage, and regular security audits.',
      difficulty: 'Hard',
      topic: 'Integration Service'
    },
    {
      id: 157,
      question: 'What is the purpose of webhooks in the UiPath Integration Service?',
      options: ['Webhooks are not used in UiPath', 'To allow Orchestrator to trigger external systems or applications when specific events occur', 'To replace email notifications', 'To delete workflows automatically'],
      correctAnswer: 1,
      explanation: 'Webhooks enable event-driven integration by allowing Orchestrator to automatically invoke external HTTP endpoints when job events (completion, failure, etc.) occur.',
      difficulty: 'Hard',
      topic: 'Integration Service'
    },
    {
      id: 158,
      question: 'When automating email workflows in Outlook, which property of the Mail Message object is used to specify multiple recipients?',
      options: ['To', 'Cc', 'Recipients', 'EmailAddresses'],
      correctAnswer: 0,
      explanation: 'The To property accepts multiple email addresses separated by semicolons (e.g., "user1@domain.com;user2@domain.com") for sending emails to multiple recipients.',
      difficulty: 'Easy',
      topic: 'Email Automation'
    },
    {
      id: 159,
      question: 'A developer creates an In/Out argument named `io_Counter` with initial value 0. Inside a parallel activity, two sequences both increment this argument. What is a critical concern?',
      options: ['In/Out arguments cannot be used in parallel activities', 'Race conditions may occur since both sequences modify the same variable simultaneously, leading to unpredictable results', 'The argument will automatically synchronize across parallel branches', 'This pattern is completely safe and requires no special handling'],
      correctAnswer: 1,
      explanation: 'Parallel execution of sequences accessing the same In/Out argument without synchronization (locks) risks race conditions where modifications interleave unexpectedly.',
      difficulty: 'Hard',
      topic: 'Variables and Arguments'
    },
    {
      id: 160,
      question: 'What is the primary objective of regression testing in RPA automation?',
      options: ['To test only new features added to a workflow', 'To verify that recent code changes do not break previously working functionality', 'To measure robot performance metrics', 'To replace unit testing entirely'],
      correctAnswer: 1,
      explanation: 'Regression testing ensures that bug fixes and new features do not inadvertently break existing workflows or functionality that was previously working correctly.',
      difficulty: 'Medium',
      topic: 'RPA Testing'
    },
    {
      id: 161,
      question: 'How should stress testing be conducted for an unattended RPA bot that processes invoices?',
      options: ['Submit a single invoice at a time', 'Gradually increase invoice volume to find the maximum throughput and identify performance degradation points', 'Stress testing is not applicable to RPA', 'Only test with the minimum expected volume'],
      correctAnswer: 1,
      explanation: 'Stress testing involves gradually increasing load to identify breaking points, bottlenecks, and performance degradation, helping determine safe production capacity.',
      difficulty: 'Hard',
      topic: 'RPA Testing'
    },
    {
      id: 162,
      question: 'Which version control system is most commonly recommended for UiPath projects in an enterprise environment?',
      options: ['FTP only', 'Git (with platforms like GitHub, GitLab, or Azure DevOps)', 'Manual file copying', 'No version control is needed for RPA'],
      correctAnswer: 1,
      explanation: 'Git is the industry standard for version control in UiPath projects, enabling branching, merging, collaboration, and audit trails within Azure DevOps, GitHub, or GitLab.',
      difficulty: 'Easy',
      topic: 'Version Control integration'
    },
    {
      id: 163,
      question: 'When integrating UiPath Studio with Git, what is the purpose of the .gitignore file in an RPA project?',
      options: ['To store sensitive information like API keys', 'To exclude files like .local, .nuget, and user-specific settings from version control', 'To document all commits', 'Git projects do not use .gitignore'],
      correctAnswer: 1,
      explanation: '.gitignore specifies which files (build outputs, local caches, user settings) should not be tracked by Git, preventing unnecessary clutter and conflicts in the repository.',
      difficulty: 'Medium',
      topic: 'Version Control integration'
    },
    {
      id: 164,
      question: 'What is a primary benefit of using UiPath Templates in a project?',
      options: ['Templates eliminate the need to write any code', 'Templates provide pre-built project structures and workflows that standardize development and reduce repetitive coding', 'Templates can only be used for email automation', 'Templates are deprecated in current versions of Studio'],
      correctAnswer: 1,
      explanation: 'Templates offer pre-configured workflows, activity layouts, and best practices that accelerate development and ensure consistency across multiple projects.',
      difficulty: 'Easy',
      topic: 'Libraries and Templates'
    },
    {
      id: 165,
      question: 'How can a developer reuse custom activities across multiple projects?',
      options: ['Copy and paste the activity code into each project', 'Package activities as a Library project and consume it via NuGet or local reference', 'Custom activities cannot be reused', 'Use only built-in UiPath activities'],
      correctAnswer: 1,
      explanation: 'Libraries allow developers to encapsulate custom workflows and activities, then publish them to NuGet or share them locally so multiple projects can reference and reuse them.',
      difficulty: 'Medium',
      topic: 'Libraries and Templates'
    },
    {
      id: 166,
      question: 'What is the difference between Attended and Unattended robot licensing in UiPath?',
      options: ['There is no difference', 'Attended robots require manual user initiation on a user\'s workstation, while Unattended robots execute automatically on enterprise servers without user intervention', 'Unattended robots are cheaper but less capable', 'Attended robots only support email automation'],
      correctAnswer: 1,
      explanation: 'Attended robots are human-supervised and run on individual desktops, while Unattended robots operate autonomously on shared enterprise infrastructure, requiring different deployment and licensing models.',
      difficulty: 'Easy',
      topic: 'Platform Knowledge'
    },
    {
      id: 167,
      question: 'What is the primary role of Automation Hub in the UiPath Platform?',
      options: ['A project management tool', 'A central marketplace and discovery platform for publishing and discovering automations, skills, and best practices across the organization', 'A debugging environment', 'A robot monitoring dashboard only'],
      correctAnswer: 1,
      explanation: 'Automation Hub serves as a marketplace where organizations can catalog, discover, and share automation assets, fostering reusability and collaboration across teams.',
      difficulty: 'Hard',
      topic: 'Platform Knowledge'
    },
    {
      id: 168,
      question: 'When automating PDF extraction in UiPath, which activity is used to extract text from a specific area of a PDF document?',
      options: ['Extract Data from PDF', 'Read PDF with OCR', 'Get OCR Text', 'Use Computer Vision to extract region-specific text from a PDF page'],
      correctAnswer: 3,
      explanation: 'For extracting text from specific regions of PDFs, the Computer Vision activity combined with OCR provides accurate region-based text extraction, especially useful for structured forms.',
      difficulty: 'Hard',
      topic: 'PDF Automation'
    },
    {
      id: 169,
      question: 'What is a key consideration when automating PDF processing for documents with varying layouts?',
      options: ['All PDFs have identical structure, so no special handling is needed', 'Use a combination of template matching and AI Document Understanding to handle layout variations', 'PDF automation is not recommended', 'Manually adjust selectors for each document'],
      correctAnswer: 1,
      explanation: 'Variable PDF layouts require flexible approaches like document templates, AI-powered Document Understanding, or dynamic anchor-based extraction to maintain robustness.',
      difficulty: 'Medium',
      topic: 'PDF Automation'
    },
    {
      id: 170,
      question: 'In Studio Modern design experience, what is the primary purpose of the Object Repository?',
      options: ['To store workflow variables', 'To centralize and manage UI element selectors used across multiple workflows, improving maintainability', 'To store database queries', 'Object Repository is not available in Modern design'],
      correctAnswer: 1,
      explanation: 'The Object Repository provides a centralized location for storing UI element selectors, making them reusable across workflows and reducing maintenance when UIs change.',
      difficulty: 'Medium',
      topic: 'Studio Interface'
    },
    {
      id: 171,
      question: 'What does the Workflow Analyzer panel in Studio provide?',
      options: ['It only displays workflow execution logs', 'It performs static code analysis identifying performance issues, best practice violations, and potential bugs before runtime', 'It automatically fixes all errors', 'It is only available in StudioX'],
      correctAnswer: 1,
      explanation: 'Workflow Analyzer performs real-time static analysis flagging performance problems, best practice deviations (e.g., slow selectors, unused variables), and potential runtime issues.',
      difficulty: 'Medium',
      topic: 'Studio Interface'
    },
    {
      id: 172,
      question: 'Which activity is used to read the contents of all files in a specific folder in a workflow?',
      options: ['Read File', 'Read Folder Contents', 'Directory.GetFiles() with For Each loop', 'List Files'],
      correctAnswer: 2,
      explanation: 'The pattern System.IO.Directory.GetFiles() returns an array of file paths, which is then iterated using For Each with TypeArgument set to String to process each file.',
      difficulty: 'Medium',
      topic: 'Files and Folders'
    },
    {
      id: 173,
      question: 'When automating file operations, why is it important to validate that a file path exists before processing it?',
      options: ['File validation is unnecessary', 'To prevent runtime exceptions and ensure graceful error handling if a file is missing, moved, or inaccessible', 'All files are guaranteed to exist', 'Validation slows down automation'],
      correctAnswer: 1,
      explanation: 'Checking file existence using System.IO.File.Exists() before processing prevents unexpected runtime failures and allows workflows to handle missing files gracefully.',
      difficulty: 'Easy',
      topic: 'Files and Folders'
    },
    {
      id: 174,
      question: 'In a typical RPA project lifecycle, what is the purpose of the design phase in the implementation methodology?',
      options: ['To execute the automation immediately', 'To define detailed technical specifications, architecture, selectors, error handling, and design decisions based on business requirements', 'To decommission the process', 'Design phases are not used in modern RPA'],
      correctAnswer: 1,
      explanation: 'The design phase bridges business requirements (PDD) and development, creating detailed technical architecture, UI automation strategies, and exception handling approaches.',
      difficulty: 'Medium',
      topic: 'Implementation Methodology'
    },
    {
      id: 175,
      question: 'What is the primary objective of the deployment phase in an RPA implementation?',
      options: ['To finalize coding', 'To deploy the tested automation to production environments, configure Orchestrator settings, and establish monitoring and support procedures', 'To collect business requirements', 'Deployment is handled automatically by Studio'],
      correctAnswer: 1,
      explanation: 'Deployment involves moving tested workflows to production, configuring robots, setting queue parameters, establishing audit trails, and initiating operational support and monitoring.',
      difficulty: 'Hard',
      topic: 'Implementation Methodology'
    },
    {
      id: 176,
      question: 'In the support and optimization phase of RPA implementation, what metrics should be monitored?',
      options: ['No monitoring is required', 'Exception rates, throughput, execution time, error logs, and business KPIs to ensure ongoing efficiency and identify improvement opportunities', 'Only execution count', 'Metrics are only collected during testing'],
      correctAnswer: 1,
      explanation: 'Ongoing monitoring of performance metrics, error rates, and business outcomes enables teams to optimize processes, address bottlenecks, and maximize ROI post-deployment.',
      difficulty: 'Hard',
      topic: 'Implementation Methodology'
    },
    {
      id: 177,
      question: 'What type of issues does the Workflow Analyzer flag in the "Performance" category?',
      options: ['Syntax errors only', 'Issues like slow selectors, large loops, missing delays, and activities that may cause performance degradation', 'Security vulnerabilities', 'Workflow Analyzer does not check performance'],
      correctAnswer: 1,
      explanation: 'The Performance category identifies potential runtime efficiency issues such as inefficient UI automation, missing delays between actions, and computationally expensive operations.',
      difficulty: 'Medium',
      topic: 'Workflow Analyzer'
    },
    {
      id: 178,
      question: 'How can a developer suppress a specific Workflow Analyzer rule if it is not applicable to their project?',
      options: ['Workflow Analyzer rules cannot be customized', 'By adding a SuppressAnalyzer attribute with the rule ID to the activity or workflow', 'By deleting the activity entirely', 'Only administrators can disable rules'],
      correctAnswer: 1,
      explanation: 'The SuppressAnalyzer attribute allows developers to locally suppress specific rule violations on individual activities or workflows when a rule is intentionally not applicable.',
      difficulty: 'Hard',
      topic: 'Workflow Analyzer'
    },
    {
      id: 179,
      question: 'What is the benefit of using custom Workflow Analyzer rules in an enterprise RPA program?',
      options: ['Custom rules are not recommended', 'To enforce organization-specific coding standards, architectural guidelines, and best practices across all projects and teams', 'Custom rules slow down development', 'Workflow Analyzer only uses built-in rules'],
      correctAnswer: 1,
      explanation: 'Custom Workflow Analyzer rules codify enterprise standards, ensuring consistency, quality, and compliance across all RPA projects developed within an organization.',
      difficulty: 'Hard',
      topic: 'Workflow Analyzer'
    },
    {
      id: 180,
      question: 'What is the primary role of UiPath Orchestrator in an enterprise RPA environment?',
      options: ['Orchestrator is only for development', 'Orchestrator is the central platform for robot management, job scheduling, queue processing, logging, and providing runtime governance and monitoring', 'Orchestrator replaces UiPath Studio', 'Orchestrator is optional'],
      correctAnswer: 1,
      explanation: 'Orchestrator serves as the backbone of RPA operations, managing robot lifecycles, executing scheduled and queued jobs, maintaining audit logs, and enforcing security policies.',
      difficulty: 'Easy',
      topic: 'Orchestrator'
    },
    {
      id: 181,
      question: 'How does Orchestrator leverage Process Mining in an RPA program?',
      options: ['Process Mining is not part of Orchestrator', 'Process Mining analyzes historical execution data to visualize process flows, identify bottlenecks, and recommend automation opportunities', 'Process Mining only works with unattended robots', 'Process Mining is a manual process'],
      correctAnswer: 1,
      explanation: 'Orchestrator\'s Process Mining features extract and analyze logs from transactional systems to create process visualizations and identify high-ROI automation candidates.',
      difficulty: 'Hard',
      topic: 'Orchestrator'
    },
    {
      id: 182,
      question: 'What is the purpose of Orchestrator Queues in managing RPA workflows?',
      options: ['Queues are not used in Orchestrator', 'Queues store transaction-level work items, enabling asynchronous job distribution, parallel processing, and decoupling of trigger and processing logic', 'Queues only store scheduled jobs', 'Queues replace variables entirely'],
      correctAnswer: 1,
      explanation: 'Orchestrator Queues decouple transaction generation from processing, allowing workflows to add work items that are later consumed by robots in parallel, enabling scalable processing.',
      difficulty: 'Medium',
      topic: 'Orchestrator'
    },
    {
      id: 183,
      question: 'When integrating third-party applications with UiPath using the Integration Service, what authentication method is most secure?',
      options: ['Hardcoded credentials in workflows', 'OAuth 2.0 or API token-based authentication with secure credential storage in Orchestrator assets', 'No authentication needed', 'Plain text passwords in configuration files'],
      correctAnswer: 1,
      explanation: 'OAuth 2.0 and token-based methods with credentials securely stored in Orchestrator (not hardcoded) provide enterprise-grade security for third-party integrations.',
      difficulty: 'Hard',
      topic: 'Integration Service'
    },
    {
      id: 184,
      question: 'How can a workflow trigger an external system event using the Integration Service?',
      options: ['External systems cannot be triggered', 'By making HTTP REST API calls from the workflow to external endpoints with appropriate payloads and headers', 'Integration Service only receives data', 'External triggers require manual intervention'],
      correctAnswer: 1,
      explanation: 'Workflows use HTTP activities (POST, GET, PUT) to invoke external system APIs, sending data and receiving responses through the Integration Service.',
      difficulty: 'Medium',
      topic: 'Integration Service'
    },
    {
      id: 185,
      question: 'What is event-driven automation in the context of UiPath Integration Service?',
      options: ['Automation that runs on a fixed schedule only', 'Automation triggered by external events (webhooks, API calls) enabling real-time response to business events without polling', 'Integration Service does not support events', 'Event-driven automation is deprecated'],
      correctAnswer: 1,
      explanation: 'Event-driven automation through webhooks and API triggers allows workflows to respond immediately to external events, improving responsiveness and reducing latency.',
      difficulty: 'Hard',
      topic: 'Integration Service'
    },
    {
      id: 186,
      question: 'What is the primary purpose of UiPath Document Understanding in modern automation?',
      options: ['Document Understanding only processes PDFs', 'Document Understanding uses AI and ML to intelligently extract structured data from unstructured documents like invoices, receipts, and contracts', 'Document Understanding replaces all OCR', 'Document Understanding is only for attended robots'],
      correctAnswer: 1,
      explanation: 'Document Understanding leverages AI/ML to automatically classify, extract, and validate data from unstructured documents without hard-coded rules, handling format variations.',
      difficulty: 'Medium',
      topic: 'Document Understanding'
    },
    {
      id: 187,
      question: 'How does Document Understanding improve efficiency compared to traditional OCR-based extraction?',
      options: ['Document Understanding is slower than OCR', 'Document Understanding uses machine learning to understand context and layout, reducing false positives, improving accuracy, and requiring less maintenance as documents evolve', 'OCR and Document Understanding are identical', 'Document Understanding cannot handle rotated text'],
      correctAnswer: 1,
      explanation: 'ML-powered Document Understanding adapts to document variations and learns from feedback, whereas traditional OCR is rule-based and less adaptable to layout changes.',
      difficulty: 'Hard',
      topic: 'Document Understanding'
    },
    {
      id: 188,
      question: 'What is a Document Understanding classifier used for?',
      options: ['Classifiers only sort documents alphabetically', 'Classifiers automatically categorize documents into predefined types (e.g., Invoice, PO, Receipt) based on content analysis', 'Classifiers cannot handle multiple document types', 'Classifiers are not part of Document Understanding'],
      correctAnswer: 1,
      explanation: 'Classifiers in Document Understanding use AI to analyze documents and automatically assign them to predefined categories, enabling batch processing by type.',
      difficulty: 'Medium',
      topic: 'Document Understanding'
    },
    {
      id: 189,
      question: 'How should high-confidence and low-confidence extraction results from Document Understanding be handled?',
      options: ['Ignore confidence scores', 'High-confidence results proceed automatically; low-confidence extractions are flagged for human review or validation to ensure accuracy and prevent errors', 'All results proceed without review', 'Confidence scores are only for reporting'],
      correctAnswer: 1,
      explanation: 'A hybrid approach routes high-confidence results to downstream processing and queues low-confidence items for human validation, balancing automation and accuracy.',
      difficulty: 'Hard',
      topic: 'Document Understanding'
    },
    {
      id: 190,
      question: 'What is the benefit of using pre-built Document Understanding models in UiPath?',
      options: ['Pre-built models are not available', 'Pre-built models for common document types (invoices, receipts, W2 forms) accelerate deployment by providing pre-trained extraction capabilities', 'Pre-built models are less accurate than custom models', 'Pre-built models only support PDF format'],
      correctAnswer: 1,
      explanation: 'UiPath offers pre-trained models for common business documents, enabling faster implementation without extensive training data and ML expertise.',
      difficulty: 'Easy',
      topic: 'Document Understanding'
    },
    {
      id: 191,
      question: 'In Document Understanding, what is transfer learning and why is it valuable?',
      options: ['Transfer learning is not used in Document Understanding', 'Transfer learning reuses knowledge from pre-trained models on new, similar document types, reducing training time and improving accuracy with limited labeled data', 'Transfer learning only applies to images', 'Transfer learning increases processing time'],
      correctAnswer: 1,
      explanation: 'Transfer learning allows models trained on large datasets to be fine-tuned on organization-specific documents with minimal labeled examples, accelerating custom model development.',
      difficulty: 'Hard',
      topic: 'Document Understanding'
    },
    {
      id: 192,
      question: 'How does Document Understanding handle documents with watermarks, stamps, or annotations that may interfere with extraction?',
      options: ['Document Understanding cannot handle such documents', 'AI models in Document Understanding are trained to filter out visual noise and focus on relevant data fields, improving extraction accuracy despite watermarks or stamps', 'Manual removal of watermarks is required', 'Watermarks completely prevent extraction'],
      correctAnswer: 1,
      explanation: 'Advanced ML models in Document Understanding robustly extract data even when documents contain watermarks, stamps, or annotations by learning to distinguish relevant content.',
      difficulty: 'Hard',
      topic: 'Document Understanding'
    },
    {
      id: 193,
      question: 'What post-processing steps are recommended after Document Understanding extraction to ensure data quality?',
      options: ['No validation is needed', 'Implement format validation, duplicate detection, range checks, and cross-reference verification to catch extraction errors and ensure downstream system compatibility', 'Post-processing slows automation', 'Document Understanding guarantees 100% accuracy'],
      correctAnswer: 1,
      explanation: 'Post-processing validates extracted data using business rules, format checks, and reconciliation with source documents to maintain data integrity and system compatibility.',
      difficulty: 'Hard',
      topic: 'Document Understanding'
    }
  ];

  constructor(private databaseService: DatabaseService) {
    this.loadAttempts();
  }

  private loadAttempts(): void {
    // Load from localStorage or initialize empty
    const stored = localStorage.getItem('quizAttempts');
    if (stored) {
      this.quizAttempts$.next(JSON.parse(stored));
    }
  }

  private saveAttempts(): void {
    localStorage.setItem('quizAttempts', JSON.stringify(this.quizAttempts$.value));
  }

  /**
   * Get all quiz questions
   */
  getQuizQuestions(): QuizQuestion[] {
    return this.quizQuestions;
  }

  /**
   * Get questions by topic
   */
  getQuestionsByTopic(topic: string): QuizQuestion[] {
    return this.quizQuestions.filter(q => q.topic === topic);
  }

  /**
   * Get shuffled questions for exam
   */
  getShuffledQuestions(count?: number): QuizQuestion[] {
    const questions = [...this.quizQuestions];
    // Fisher-Yates shuffle
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    return count ? questions.slice(0, count) : questions;
  }

  /**
   * Start a new quiz attempt
   */
  startQuizAttempt(questionCount: number = 10, timeMinutes: number = 30): QuizAttempt {
    const questions = this.getShuffledQuestions(questionCount);
    const attempt: QuizAttempt = {
      id: this.generateAttemptId(),
      quizId: 1,
      userId: 1, // In real app, get from auth service
      questions: questions,
      userAnswers: new Array(questions.length).fill(null),
      score: 0,
      totalQuestions: questions.length,
      percentageScore: 0,
      timeSpent: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      status: 'in-progress'
    };
    this.currentAttempt$.next(attempt);
    return attempt;
  }

  /**
   * Submit an answer for a question
   */
  submitAnswer(questionIndex: number, selectedOptionIndex: number): void {
    const attempt = this.currentAttempt$.value;
    if (attempt) {
      attempt.userAnswers[questionIndex] = selectedOptionIndex;
      this.currentAttempt$.next(attempt);
    }
  }

  /**
   * Complete the quiz and calculate results
   */
  completeQuiz(timeSpent: number): QuizResult {
    const attempt = this.currentAttempt$.value;
    if (!attempt) throw new Error('No active quiz attempt');

    let correctCount = 0;
    const difficultyBreakdown = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };

    attempt.questions.forEach((question, index) => {
      const difficulty = question.difficulty.toLowerCase() as keyof typeof difficultyBreakdown;
      difficultyBreakdown[difficulty].total++;

      if (attempt.userAnswers[index] === question.correctAnswer) {
        correctCount++;
        difficultyBreakdown[difficulty].correct++;
      }
    });

    const percentageScore = Math.round((correctCount / attempt.totalQuestions) * 100);
    const passingScore = 70;

    attempt.score = correctCount;
    attempt.percentageScore = percentageScore;
    attempt.timeSpent = timeSpent;
    attempt.completedAt = new Date();
    attempt.status = 'completed';

    // Save attempt
    const attempts = this.quizAttempts$.value;
    attempts.push(attempt);
    this.quizAttempts$.next(attempts);
    this.saveAttempts();

    const result: QuizResult = {
      attemptId: attempt.id,
      score: correctCount,
      totalQuestions: attempt.totalQuestions,
      percentageScore: percentageScore,
      timeSpent: timeSpent,
      passed: percentageScore >= passingScore,
      passingScore: passingScore,
      correctAnswers: correctCount,
      incorrectAnswers: attempt.totalQuestions - correctCount,
      unansweredQuestions: attempt.userAnswers.filter(a => a === null).length,
      difficultyBreakdown: difficultyBreakdown
    };

    this.currentAttempt$.next(null);
    return result;
  }

  /**
   * Get user's quiz attempt history
   */
  getUserAttempts(userId: number): Observable<QuizAttempt[]> {
    return this.quizAttempts$.pipe(
      map(attempts => attempts.filter(a => a.userId === userId && a.status === 'completed'))
    );
  }

  /**
   * Get current quiz attempt
   */
  getCurrentAttempt(): Observable<QuizAttempt | null> {
    return this.currentAttempt$.asObservable();
  }

  /**
   * Get quiz statistics
   */
  getQuizStatistics(userId: number) {
    const attempts = this.quizAttempts$.value.filter(a => a.userId === userId && a.status === 'completed');
    
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        totalTimeSpent: 0
      };
    }

    return {
      totalAttempts: attempts.length,
      averageScore: Math.round(attempts.reduce((sum, a) => sum + a.percentageScore, 0) / attempts.length),
      bestScore: Math.max(...attempts.map(a => a.percentageScore)),
      totalTimeSpent: attempts.reduce((sum, a) => sum + a.timeSpent, 0)
    };
  }

  private generateAttemptId(): string {
    return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
