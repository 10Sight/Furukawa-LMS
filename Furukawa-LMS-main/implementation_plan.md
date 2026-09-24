# Implementation Plan: Editable Containment Action Fields After Row Approval in Daily 5M Recording

## Objective
Ensure that all fields under the **"Containment Action if required"** column and its sub-columns remain **editable** in [Daily5MRecording.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/CMS/Daily5MRecording.jsx), even after a sheet's row has been **Approved** (`rec_${recIndex}_RowStatus === 'APPROVED'`).

---

## 1. Background & Root Cause Analysis

In `Daily5MRecording.jsx`, when a supervisor / QA in-charge approves a row, `rec_${recIndex}_RowStatus` becomes `'APPROVED'`.
Currently:
1. **In `Standard` (Assembly & SRC) Layouts**:
   - `Support Person` (`rec_${recIndex}_Cont1_Shift`) and `Detail if NG` (`rec_${recIndex}_Cont3_NGDetail`) use `disabled={isLocked}`, which evaluates to `true` when `rowStatus === 'APPROVED'`.
   - `Produced Qty` (`Cont1_Day_1`), `NG Qty` (`Cont1_Day_2`), `Dim Checks 1, 2, 3` (`Cont_Dim_1`, `Cont_Dim_2`, `Cont_Dim_3`), and `Remarks` (`Cont1_Remarks`) evaluate `(rowStatus === 'APPROVED' && !isAdmin)` and `(rowStatus && !canEditSubmitted5M)`, locking non-admin users from editing containment values.
2. **In `Crimping` (Cutting & Crimping) Layout**:
   - `isFieldLocked` locks fields whenever `rowStatus === 'APPROVED' && !authUser?.isAdmin` or `rowStatus && !canEditSubmitted5M`.
   - `Support Person` (`rec_${recIndex}_Cont_SupportPerson`) uses `disabled={isLocked}`.
   - `Remarks` uses `disabled={isFieldLocked('Remarks')}`.
   - Length check and NG detail inputs lack consistent containment-specific editability rules.

---

## 2. Complete Inventory of Containment Action Fields

### A. Standard Layout (Assembly / SRC)
| Header & Sub-Header | Field Key | Input Control | Existing Lock Condition | Target Lock Condition |
| :--- | :--- | :--- | :--- | :--- |
| **Support Person Name** | `rec_${i}_Cont1_Shift` | `UserAutocomplete` | `disabled={isLocked}` | `disabled={isContainmentLocked}` |
| **Visual Check - Produced Qty** | `rec_${i}_Cont1_Day_1` | `AutoResizeTextarea` | Locked when approved | `disabled={isContainmentLocked}` |
| **Visual Check - NG Qty** | `rec_${i}_Cont1_Day_2` | `AutoResizeTextarea` | Locked when approved | `disabled={isContainmentLocked}` |
| **Dimension Check - 1st Check** | `rec_${i}_Cont_Dim_1` | `AutoResizeTextarea` | Locked when approved | `disabled={isContainmentLocked}` |
| **Dimension Check - 2nd Check** | `rec_${i}_Cont_Dim_2` | `AutoResizeTextarea` | Locked when approved | `disabled={isContainmentLocked}` |
| **Dimension Check - 3rd Check** | `rec_${i}_Cont_Dim_3` | `AutoResizeTextarea` | Locked when approved | `disabled={isContainmentLocked}` |
| **Remarks** | `rec_${i}_Cont1_Remarks` | `AutoResizeTextarea` | Locked when approved | `disabled={isContainmentLocked}` |
| **Visual Check - Detail if NG** | `rec_${i}_Cont3_NGDetail` | `input` | `disabled={isLocked}` | `disabled={isContainmentLocked}` |

### B. Crimping Layout (`CrimpingRecord`)
| Header & Sub-Header | Field Key | Input Control | Existing Lock Condition | Target Lock Condition |
| :--- | :--- | :--- | :--- | :--- |
| **Support Person Name** | `rec_${i}_Cont_SupportPerson` | `UserAutocomplete` | `disabled={isLocked}` | `disabled={isContainmentLocked}` |
| **Visual Check - Produced Qty** | `rec_${i}_Cont_ProdQty` | `AutoResizeTextarea` | `isFieldLocked('Cont_ProdQty')` | `disabled={isContainmentLocked}` |
| **Visual Check - NG Qty** | `rec_${i}_Cont_NGQty` | `AutoResizeTextarea` | `isFieldLocked('Cont_NGQty')` | `disabled={isContainmentLocked}` |
| **Dimension - 1st Check (C/H)** | `rec_${i}_Cont_CH_Std1`, `rec_${i}_Cont_CH_Obs1` | `input` | `isFieldLocked(..., true)` | `disabled={isContainmentLocked}` |
| **Dimension - 2nd Check (C/H)** | `rec_${i}_Cont_CH_Std2`, `rec_${i}_Cont_CH_Obs2` | `input` | `isFieldLocked(..., true)` | `disabled={isContainmentLocked}` |
| **Dimension - 3rd Check (C/H)** | `rec_${i}_Cont_CH_Std3`, `rec_${i}_Cont_CH_Obs3` | `input` | `isFieldLocked(..., true)` | `disabled={isContainmentLocked}` |
| **Dimension - 1st Check (Length)** | `rec_${i}_Cont_Len_Std1`, `rec_${i}_Cont_Len_Obs1` | `input` | Unset / Inherited | `disabled={isContainmentLocked}` |
| **Dimension - 2nd Check (Length)** | `rec_${i}_Cont_Len_Std2`, `rec_${i}_Cont_Len_Obs2` | `input` | Unset / Inherited | `disabled={isContainmentLocked}` |
| **Dimension - 3rd Check (Length)** | `rec_${i}_Cont_Len_Std3`, `rec_${i}_Cont_Len_Obs3` | `input` | Unset / Inherited | `disabled={isContainmentLocked}` |
| **Remarks** | `rec_${i}_Remarks` | `AutoResizeTextarea` | `isFieldLocked('Remarks')` | `disabled={isContainmentLocked}` |
| **Visual Check - Detail if NG** | `rec_${i}_Cont_NGDetail` | `input` | Unset / Inherited | `disabled={isContainmentLocked}` |

---

## 3. Implementation Steps

### Step 1: Containment Lock Rule Definition
In [Daily5MRecording.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/CMS/Daily5MRecording.jsx):
Define a dedicated boolean expression that decouples containment action fields from row-level approval lock status while maintaining general view-only security:
```javascript
const isContainmentLocked = isReview || !hasEditPermission;
```
*(This guarantees that users in Review mode or without form edit rights cannot edit the fields, but active users with standard edit permission can edit containment fields regardless of `rowStatus === 'APPROVED'`)*.

---

### Step 2: Update `CrimpingRecord` Component
In [Daily5MRecording.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/CMS/Daily5MRecording.jsx#L770-L1227):
1. Add `const isContainmentLocked = isReview || !hasEditPermission;` inside `CrimpingRecord`.
2. Update **Support Person**:
   ```jsx
   <UserAutocomplete
       value={formData[`rec_${recIndex}_Cont_SupportPerson`] || ""}
       onChange={({ fullName }) => handleInputChange(recIndex, 'Cont_SupportPerson', fullName)}
       placeholder="Support Person"
       compact={true}
       disabled={isContainmentLocked}
   />
   ```
3. Update **Produced Qty** & **NG Qty**:
   - `disabled={isContainmentLocked}` on `rec_${recIndex}_Cont_ProdQty` and `rec_${recIndex}_Cont_NGQty`.
4. Update **Dimension Checks (C/H Std/Obs 1, 2, 3)**:
   - Apply `disabled={isContainmentLocked}` to `Cont_CH_Std1`, `Cont_CH_Obs1`, `Cont_CH_Std2`, `Cont_CH_Obs2`, `Cont_CH_Std3`, `Cont_CH_Obs3`.
5. Update **Dimension Checks (Length Std/Obs 1, 2, 3)**:
   - Apply `disabled={isContainmentLocked}` to `Cont_Len_Std1`, `Cont_Len_Obs1`, `Cont_Len_Std2`, `Cont_Len_Obs2`, `Cont_Len_Std3`, `Cont_Len_Obs3`.
6. Update **Visual NG Detail**:
   - Apply `disabled={isContainmentLocked}` to `rec_${recIndex}_Cont_NGDetail`.
7. Update **Remarks**:
   - Apply `disabled={isContainmentLocked}` to `rec_${recIndex}_Remarks`.

---

### Step 3: Update `Standard` (Assembly & SRC) Record Body
In [Daily5MRecording.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/pages/CMS/Daily5MRecording.jsx#L2420-L2805):
1. In the row rendering scope (line 2424), define `isContainmentLocked`:
   ```javascript
   const isContainmentLocked = isReview || !hasEditPermission;
   ```
2. Update **Support Person**:
   - Change `disabled={isLocked}` to `disabled={isContainmentLocked}` for `rec_${recIndex}_Cont1_Shift`.
3. Update **Produced Qty** & **NG Qty**:
   - Change `disabled={...}` to `disabled={isContainmentLocked}` for `rec_${recIndex}_Cont1_Day_1` and `rec_${recIndex}_Cont1_Day_2`.
4. Update **Dimension Checks (1st, 2nd, 3rd checks)**:
   - Change `disabled={...}` to `disabled={isContainmentLocked}` for `rec_${recIndex}_Cont_Dim_1`, `rec_${recIndex}_Cont_Dim_2`, `rec_${recIndex}_Cont_Dim_3`.
5. Update **Remarks**:
   - Change `disabled={...}` to `disabled={isContainmentLocked}` for `rec_${recIndex}_Cont1_Remarks`.
6. Update **Detail if NG (Row 3)**:
   - Change `disabled={isLocked}` to `disabled={isContainmentLocked}` for `rec_${recIndex}_Cont3_NGDetail`.

---

### Step 4: Verify Backend Persistence Behavior
In [daily5MRecord.controller.js](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/server/controllers/daily5MRecord.controller.js#L38-L57):
- When saving an updated sheet where rows are already `APPROVED`, `prevStatus === newStatus` (both are `'APPROVED'`).
- The transition check is bypassed, and the new containment action values are persisted to `daily_5m_records` via `Daily5MRecord.upsert`.

---

## 4. Verification & Testing Checklist

- [ ] **Standard / Assembly Row Verification**:
  - Approve Row 1 in an active Daily 5M sheet.
  - Verify preceding columns (Operator, Problem, Shift, QA Incharge, First Part Approval) are disabled.
  - Verify all Containment Action fields (Support Person, Produced Qty, NG Qty, Dim 1/2/3, Remarks, Detail if NG) are **active and editable**.
  - Edit values, click **"Save Daily 5M"**, and refresh to confirm data persists with `RowStatus: APPROVED`.
- [ ] **Crimping Row Verification**:
  - Approve Row 1 in a Crimping sheet.
  - Verify C/H Std/Obs, Length Std/Obs, Support Person, Quantities, Remarks, and NG detail remain editable and persist upon save.
- [ ] **Review Mode Security Check**:
  - Open in Review / Print Preview mode (`isReview = true`) and ensure all containment fields are disabled as read-only.
