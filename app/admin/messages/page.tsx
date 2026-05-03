import { AdminErrorNotice } from "@/components/admin/admin-error-notice";
import { AdminMessagesClient } from "@/components/admin/admin-messages-client";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requireAdminPageAccess } from "@/lib/admin/auth";
import { getAdminContactMessagesData } from "@/lib/admin/contact-messages";

export default async function AdminMessagesPage() {
  requireAdminPageAccess();

  const data = await getAdminContactMessagesData();

  return (
    <div>
      <AdminPageHeader
        title="Messages"
        description="Review inbound contact messages, mark them as read, and reply without leaving the admin dashboard."
      />

      <AdminErrorNotice message={data.error} />

      <AdminMessagesClient
        initialRows={data.rows}
        initialUnreadCount={data.unreadCount}
      />
    </div>
  );
}
