import { env } from "cloudflare:workers";
import { readPublication } from "../../../social-service";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
 const {token}=await params;const data=await readPublication(env.DB!,token);
 return Response.json(data||{error:"Trang này chưa được chia sẻ hoặc đã tắt."},{status:data?200:404,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
