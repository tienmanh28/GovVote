import { useRef } from "react";
type Query = { data?:unknown; dataUpdatedAt?:number; error?:unknown; isFetching?:boolean; isPlaceholderData?:boolean };
export type Freshness = { at?:number; block?:bigint; state:"loading"|"refreshing"|"stale/error"|"ready" };
// Timestamp từ query thành công, không dùng Date.now() giả làm thời điểm đọc.
export function freshnessSnapshot(previous:{scope:string;at?:number;block?:bigint},queries:Query[],scope:string,block?:bigint){
 let memory=previous.scope===scope?previous:{scope,at:undefined,block:undefined};
 const error=queries.some((q)=>!!q.error),fetching=queries.some((q)=>q.isFetching);
 const complete=queries.length>0&&queries.every((q)=>q.data!==undefined&&(q.dataUpdatedAt??0)>0&&!q.isPlaceholderData)&&!error&&!fetching;
 if(complete)memory={scope,at:Math.max(...queries.map((q)=>q.dataUpdatedAt??0)),block};
 const info:Freshness={at:memory.at,block:memory.block,state:error?"stale/error":fetching?"refreshing":complete?"ready":memory.at?"refreshing":"loading"};
 return {memory,info};
}
export function useFreshness(queries:Query[],scope:string,block?:bigint):Freshness {
 const memory=useRef<{scope:string;at?:number;block?:bigint}>({scope});
 const next=freshnessSnapshot(memory.current,queries,scope,block);memory.current=next.memory;return next.info;
}
export function DataFreshness({info}:{info:Freshness}){
 return <p className="mb-3 text-xs text-slate-600 wrap-anywhere" data-testid="data-freshness" data-state={info.state}>
  Lần hoàn tất đọc thành công: {info.at?new Date(info.at).toISOString():"Chưa có"}{info.block!==undefined?` · block ${info.block}`:""}. Trạng thái: {{ready:"Đã đọc thành công",loading:"Đang tải",refreshing:"Đang làm mới","stale/error":"Dữ liệu cũ / lỗi"}[info.state]}. Đây là thời điểm đọc, không phải đồng hồ hiện tại hoặc chứng nhận finality.
 </p>;
}
