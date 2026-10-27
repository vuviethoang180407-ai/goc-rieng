import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { handleSocial } from "../../social-service";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
 const user=await getChatGPTUser();
 return handleSocial(request, env.DB!, user ? {id:user.userId,name:user.fullName || "Người bạn mới"} : null);
}
export const GET=handle;
export const POST=handle;
