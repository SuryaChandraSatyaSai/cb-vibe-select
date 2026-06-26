import { auth } from "./auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");

  // Redirect to login page if user is not logged in and tries to access protected routes
  if (!isLoggedIn && !isLoginPage && !isAuthRoute) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Redirect logged-in users away from the login page to the dashboard
  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }
});

// Matcher to protect all routes except static files, public files, and icons
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
