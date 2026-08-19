// Re-export all email functions from the centralized template module.
// This file exists for backward compatibility — leaveRequests.js imports from here.
export {
  sendLeaveSubmitted,
  sendPendingApproval,
  sendLeaveApproved,
  sendLeaveRejected,
  sendCancellationPending,
  sendCancellationApproved,
  sendWelcomeEmail,
  sendPasswordResetOtp,
  sendEmailCorrection,
  sendAdminNotification,
} from "./emailTemplates.js";
