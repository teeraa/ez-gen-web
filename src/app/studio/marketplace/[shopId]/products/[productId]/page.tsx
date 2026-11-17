import { Suspense } from "react";
import { ProductManage } from "@/components/marketplace/product-manage";

export const metadata = { title: "Marketplace — จัดการสินค้า" };

type Params = Promise<{ shopId: string; productId: string }>;

async function Product({ params }: { params: Params }) {
  const { shopId, productId } = await params;
  return <ProductManage shopId={shopId} productId={productId} />;
}

export default function MarketplaceProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p role="status">กำลังเปิดสินค้า…</p>}>
      <Product params={params} />
    </Suspense>
  );
}
