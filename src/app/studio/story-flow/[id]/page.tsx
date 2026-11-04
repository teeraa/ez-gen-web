import { Suspense } from 'react';
import { StoryFlow } from '@/components/story-flow/workspace';
async function Project({params}:{params:Promise<{id:string}>}){const {id}=await params;return <StoryFlow projectId={id}/>}
export default function StoryProjectPage({params}:{params:Promise<{id:string}>}){return <Suspense fallback={<p role="status">กำลังเปิด Story Flow…</p>}><Project params={params}/></Suspense>}
