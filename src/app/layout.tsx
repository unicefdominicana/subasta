import type { Metadata } from "next"; import "./globals.css";
export const metadata:Metadata={title:"Subasta A Taste of Hope",description:"Subasta benéfica de A Taste of Hope a beneficio de la niñez."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
