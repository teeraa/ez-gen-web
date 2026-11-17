import { Suspense } from "react";
import { ShopProducts } from "@/components/marketplace/shop-products";

export const metadata = { title: "Marketplace — สินค้าในร้าน" };

async function Shop({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  return <ShopProducts id={shopId} />;
}

export default function MarketplaceShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  return (
    <Suspense fallback={<p role="status">กำลังเปิดร้านค้า…</p>}>
      <Shop params={params} />
    </Suspense>
  );
}
