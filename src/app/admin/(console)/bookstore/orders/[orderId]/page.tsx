import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/feedback";
import { OrderAdminDetail } from "@/features/admin/bookstore-orders";
import { createSeed, SERVER_ANCHOR } from "@/lib/mock/seed";

export const metadata: Metadata = { title: "Order details" };

export function generateStaticParams() {
  return createSeed(SERVER_ANCHOR).bookOrders.map((o) => ({ orderId: o.id }));
}

export default function Page({ params }: PageProps<"/admin/bookstore/orders/[orderId]">) {
  return (
    <Suspense fallback={<PageSkeleton variant="admin" />}>
      {params.then(({ orderId }) => (
        <OrderAdminDetail orderId={orderId} />
      ))}
    </Suspense>
  );
}
