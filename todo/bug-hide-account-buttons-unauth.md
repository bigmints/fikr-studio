# User Story: Hide Account & Sync Buttons for Unauthenticated Users

## Description
As a user of Fikr Studio,
I should not see options to "Manage Account" or "Sync Now" when I am not logged into the app,
So that the user interface is clean, intuitive, and only shows features that are actually available to me in an offline/unauthenticated state.

## Current Behavior
In the profile dropdown menu (accessed via the bottom left corner), the "Manage Account" button is always visible, regardless of whether a user is logged in or not. Furthermore, while the "Sync Now" button is technically guarded by the subscription plan flag (`isManagedPlan`), it does not explicitly check for an active user session, which could lead to edge cases where the button appears or behaves unexpectedly for non-logged-in users.

## Expected Behavior
- The "Manage Account" menu item should be hidden completely when the user is not logged in.
- The "Sync Now" menu item should strictly require an active user session (in addition to requiring a Pro/Plus plan).

## Acceptance Criteria
- [ ] If a user is not logged in, the "Manage Account" button is not rendered in the profile dropdown.
- [ ] If a user is not logged in, the "Sync Now" button is not rendered.
- [ ] Both buttons reappear and function correctly once the user logs in (and meets plan requirements for Sync).

## Implementation Details (Fix Strategy)
Modify the dropdown rendering logic in `components/project-sidebar.tsx`:

1. **Manage Account Button:**
   Locate the "Manage Account" `DropdownMenuItem` (around line 622) and wrap it with a `{user && (...)}` condition so it only renders for authenticated users.
   ```tsx
   {user && (
     <DropdownMenuItem className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" onClick={() => onOpenSettings("account")}>
       <Shield className="size-4" />
       <span>Manage Account</span>
     </DropdownMenuItem>
   )}
   ```

2. **Sync Now Button:**
   Locate the "Sync Now" `DropdownMenuItem` (around line 627) and update its conditional rendering to explicitly require the `user` object as well as the `isManagedPlan` flag.
   ```tsx
   {user && isManagedPlan && (
     <DropdownMenuItem 
       className="gap-2 cursor-pointer focus:bg-foreground/5 rounded-md py-2" 
       onClick={handleSyncNow} 
       disabled={isSyncing}
     >
       <RefreshCw className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
       <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
     </DropdownMenuItem>
   )}
   ```
