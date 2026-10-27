import { getChatGPTUser,chatGPTSignInPath } from "./chatgpt-auth";
import Workspace from "./workspace";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{invite?:string}>}){
 const user=await getChatGPTUser();const params=await searchParams;
 const invite=/^[a-f0-9]{32}$/.test(params.invite||"")?params.invite!:"";
 if(!user)return <main className="welcome"><div className="welcome-mark">◌ Góc riêng</div><span className="eyebrow">MỘT NƠI CHO BẠN. MỘT CHỖ CHO NHAU.</span><h1>Sống có chủ đích.<br/>Kết nối có ý nghĩa.</h1><p>Giữ điều quan trọng ở gần. Cùng bạn bè lên kế hoạch,<br/>chia sẻ công việc và bắt đầu những cuộc trò chuyện.</p>{invite&&<p className="invitation">Bạn nhận được một liên kết kết bạn. Đăng nhập để xem và gửi lời mời.</p>}<a className="primary" target="_top" href={chatGPTSignInPath(invite?"/?invite="+invite:"/")}>Đăng nhập bằng ChatGPT ↗</a><div className="welcome-features"><div><b>✧ Không gian riêng</b><p>Chỉ số, ghi chép và mục tiêu chỉ mình bạn thấy.</p></div><div><b>♧ Bạn bè chọn lọc</b><p>Kết nối qua mã mời, xác nhận trước khi tương tác.</p></div><div><b>↗ Cùng nhau tiến bước</b><p>Lịch hẹn, chia việc và tin nhắn giữa những người bạn.</p></div></div><small>Hồ sơ bạn bè chỉ chia sẻ tên và giới thiệu. Email không hiển thị.</small></main>;
 return <Workspace inviteCode={invite}/>;
}
