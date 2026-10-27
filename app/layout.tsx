import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Góc riêng · Kết nối có ý nghĩa",description:"Không gian cá nhân, bạn bè, kế hoạch chung và những cuộc trò chuyện riêng."};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="vi"><body>{children}</body></html>}
