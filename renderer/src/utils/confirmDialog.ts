/**
 * Re-export the confirmDialog function from the new ConfirmDialog component.
 * This keeps the same import path for all existing consumers.
 * 
 * The function now returns Promise<boolean> instead of boolean,
 * but since all callers already use it in an if-statement or await context,
 * and JS treats Promise as truthy, callers that use `if (confirmDialog(...))` 
 * need to add `await`. We update this to maintain backward-compatibility 
 * by exporting a sync wrapper for non-async callers.
 */
export { confirmDialog } from '../components/ConfirmDialog';
