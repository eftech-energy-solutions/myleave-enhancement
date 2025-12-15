import pool from "../db.js";
import { calculateWorkingDays } from "./calculateWorkingDays.js";

/**
 * Recalculate leave balances for all approved leaves affected by holiday changes
 * Call this after adding/deleting/hiding/unhiding holidays
 * 
 * @param {string} affectedDate - The date of the holiday that changed (YYYY-MM-DD)
 * @returns {Promise<Object>} - Summary of recalculations
 */
export async function recalculateAffectedLeaves(affectedDate) {
  try {
    console.log(`🔄 Recalculating leaves affected by holiday change on ${affectedDate}`);

    // Find all APPROVED leaves that include this date
    const { rows: affectedLeaves } = await pool.query(
      `SELECT leave_id, staff_id, staff_name, leave_type, 
              date_from, date_until, total_days, 
              deduct_cf, deduct_al
       FROM leave_requests
       WHERE status = 'approved'
         AND date_from <= $1
         AND date_until >= $1`,
      [affectedDate]
    );

    if (affectedLeaves.length === 0) {
      console.log('✅ No approved leaves affected');
      return { 
        success: true, 
        affectedCount: 0,
        recalculated: [] 
      };
    }

    console.log(`📊 Found ${affectedLeaves.length} affected leave(s)`);

    const recalculated = [];

    for (const leave of affectedLeaves) {
      const oldDays = Number(leave.total_days);
      
      // Recalculate working days with current holidays
      const newDays = await calculateWorkingDays(leave.date_from, leave.date_until);
      
      const difference = newDays - oldDays;

      if (difference === 0) {
        console.log(`⏭️ Leave ${leave.leave_id}: No change needed`);
        continue;
      }

      console.log(`🔄 Leave ${leave.leave_id}: ${oldDays} → ${newDays} days (${difference > 0 ? '+' : ''}${difference})`);

      // Update the leave request
      await pool.query(
        `UPDATE leave_requests 
         SET total_days = $1 
         WHERE leave_id = $2`,
        [newDays, leave.leave_id]
      );

      // Adjust the staff's leave balance
      const leaveType = String(leave.leave_type || "").trim().toUpperCase();

      if (leaveType === "AL" || leaveType === "EL") {
        // For Annual/Emergency leave, we need to recalculate CF/AL split
        await recalculateAnnualLeaveBalance(leave, oldDays, newDays, difference);
      } else if (leaveType === "MC") {
        // Medical leave - simple adjustment
        await pool.query(
          `UPDATE profiles 
           SET leave_entitlement_medical = leave_entitlement_medical - $1 
           WHERE staff_id = $2`,
          [difference, leave.staff_id]
        );
      } else if (leaveType === "HOSP") {
        // Hospitalization leave
        await pool.query(
          `UPDATE leave_entitlements 
           SET balance = balance - $1 
           WHERE staff_id = $2 AND leave_type = 'HOSP'`,
          [difference, leave.staff_id]
        );
      } else {
        // Other special leaves
        await pool.query(
          `UPDATE leave_entitlements 
           SET balance = balance - $1 
           WHERE staff_id = $2 AND leave_type = $3`,
          [difference, leave.staff_id, leaveType]
        );
      }

      recalculated.push({
        leave_id: leave.leave_id,
        staff_name: leave.staff_name,
        leave_type: leaveType,
        old_days: oldDays,
        new_days: newDays,
        difference: difference
      });
    }

    console.log('✅ Recalculation complete');

    return {
      success: true,
      affectedCount: recalculated.length,
      recalculated: recalculated
    };

  } catch (error) {
    console.error('❌ Error recalculating leaves:', error);
    throw error;
  }
}

/**
 * Recalculate Annual Leave balance with proper CF/AL split
 */
async function recalculateAnnualLeaveBalance(leave, oldDays, newDays, difference) {
  const staffId = leave.staff_id;
  const leaveDate = new Date(leave.date_from);

  // Get current profile data
  const { rows } = await pool.query(
    `SELECT leave_entitlement_annual, 
            carry_forward_balance, 
            carry_forward_expiry
     FROM profiles 
     WHERE staff_id = $1`,
    [staffId]
  );

  let AL = Number(rows[0].leave_entitlement_annual);
  let CF = Number(rows[0].carry_forward_balance);
  let expiry = rows[0].carry_forward_expiry ? new Date(rows[0].carry_forward_expiry) : null;

  // First, restore the old deductions
  const oldDeductCF = Number(leave.deduct_cf || 0);
  const oldDeductAL = Number(leave.deduct_al || 0);
  
  AL += oldDeductAL;
  CF += oldDeductCF;

  console.log(`📥 Restored old deductions: CF+${oldDeductCF}, AL+${oldDeductAL}`);

  // Check if CF is expired
  const today = new Date();
  if (expiry && today > expiry) {
    CF = 0;
  }

  // Calculate new deductions
  let newDeductCF = 0;
  let newDeductAL = 0;

  if (CF > 0 && expiry && leaveDate <= expiry) {
    const leaveEnd = new Date(leave.date_until);
    
    if (leaveEnd > expiry) {
      // Leave crosses expiry
      const msDay = 1000 * 60 * 60 * 24;
      const daysBeforeExpiry = Math.floor((expiry - leaveDate) / msDay) + 1;
      const daysAfterExpiry = newDays - daysBeforeExpiry;
      
      if (CF >= daysBeforeExpiry) {
        newDeductCF = daysBeforeExpiry;
        newDeductAL = daysAfterExpiry;
      } else {
        newDeductCF = CF;
        newDeductAL = newDays - CF;
      }
    } else {
      // Entire leave before expiry
      if (CF >= newDays) {
        newDeductCF = newDays;
      } else {
        newDeductCF = CF;
        newDeductAL = newDays - CF;
      }
    }
  } else {
    // Use AL only
    newDeductAL = newDays;
  }

  console.log(`📤 New deductions: CF-${newDeductCF}, AL-${newDeductAL}`);

  // Apply new deductions
  await pool.query(
    `UPDATE profiles 
     SET carry_forward_balance = $1, 
         leave_entitlement_annual = $2 
     WHERE staff_id = $3`,
    [CF - newDeductCF, AL - newDeductAL, staffId]
  );

  // Update leave request with new deductions
  await pool.query(
    `UPDATE leave_requests 
     SET deduct_cf = $1, deduct_al = $2 
     WHERE leave_id = $3`,
    [newDeductCF, newDeductAL, leave.leave_id]
  );

  // Update remaining leave
  await pool.query(
    `UPDATE profiles 
     SET remaining_leave = $1 
     WHERE staff_id = $2`,
    [(AL - newDeductAL) + (CF - newDeductCF), staffId]
  );
}

/**
 * Check if any approved leaves will be affected by holiday change
 * Use this BEFORE allowing deletion to show warning
 * 
 * @param {string} date - Holiday date (YYYY-MM-DD)
 * @returns {Promise<Object>} - Affected leaves info
 */
export async function checkHolidayImpact(date) {
  const { rows } = await pool.query(
    `SELECT leave_id, staff_name, leave_type, total_days,
            date_from, date_until
     FROM leave_requests
     WHERE status = 'approved'
       AND date_from <= $1
       AND date_until >= $1
     ORDER BY staff_name`,
    [date]
  );

  return {
    hasImpact: rows.length > 0,
    affectedCount: rows.length,
    affectedLeaves: rows
  };
}