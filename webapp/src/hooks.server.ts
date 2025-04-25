// import { handleNotAuthenticatedButNeedToBe, handleResponseFromAzureAdSso } from '$lib/server/auth';
// //import { getAppSecretConfig } from '$lib/server-util';
// import type { AuthenticatedUser, Code, UnauthenticatedUser, User } from '$lib/types';
// import { decryptValueSymmetric } from '$lib/server/util';
// import type { Handle } from '@sveltejs/kit';
// import * as cookie from 'cookie';
// import { getAppConfig } from '$lib/server/appconfig';

// export const prerender = false;

// export const handle: Handle = async ({ event, resolve }) => {
//     const pathName = new URL(event.request.url).pathname || '';
//     //-console.log(`handle route: ${event.routeId} ; path: ${pathName}`);

//     let user: User = { authenticated: false };

//     // Always set these security headers

//     if (pathName === '/health' || pathName === '/login') {
//         // Doesn't require auth.  Note that we're not setting the user object in locals here even though
//         // our typescript type in app.d.ts App.Locals has it as required.
//         const response = await resolve(event);
//         return addSecurityHeaders(response);
//     } else if (pathName === '/auth/server-redirect') {
//         // Getting response back from MS AAD, handle it
//         const appConfig = await getAppConfig();
//         const response = await handleResponseFromAzureAdSso(event, appConfig);

//         event.locals = { user, appConfig };
//         return addSecurityHeaders(response);
//     } else if (pathName === '/logout') {
//         // Delete cookies and redirect them to the login screen
//         const response = new Response('Redirect', {
//             status: 302,
//             headers: {
//                 Location: 'http://rithum.com',
//             },
//         });

//         response.headers.append('set-cookie', cookie.serialize('authRedirect', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));
//         response.headers.append('set-cookie', cookie.serialize('user', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));
//         response.headers.append('set-cookie', cookie.serialize('c', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));

//         return addSecurityHeaders(response);
//     } else {
//         // We're supposed to be authenticated
//         const appConfig = await getAppConfig();

//         const cookies = cookie.parse(event.request.headers.get('cookie') || '');
//         let cookieUser: undefined | UnauthenticatedUser | AuthenticatedUser;
//         let cookieCode: undefined | Code;
//         let badCookie = false;

//         try {
//             cookieUser = cookies.user ? JSON.parse(decryptValueSymmetric(cookies.user, appConfig.cookie_key)) : undefined;
//         } catch (ex) {
//             badCookie = true;
//         }

//         if (!badCookie) {
//             try {
//                 cookieCode = cookies.c ? JSON.parse(decryptValueSymmetric(cookies.c, appConfig.cookie_key)) : undefined;
//             } catch (ex) {
//                 badCookie = true;
//             }
//         } else {
//             /* good to continue */
//         }

//         if (badCookie) {
//             // Delete cookies and redirect them to the login screen
//             const response = new Response('Redirect', {
//                 status: 302,
//                 headers: {
//                     Location: '/login',
//                 },
//             });

//             response.headers.append('set-cookie', cookie.serialize('authRedirect', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));
//             response.headers.append('set-cookie', cookie.serialize('user', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));
//             response.headers.append('set-cookie', cookie.serialize('c', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));

//             return addSecurityHeaders(response);
//         } else {
//             /* cookie values are good, continue */
//         }

//         //-console.log(`handle cookieUser ${JSON.stringify(cookieUser, null, 4)}`);

//         if (cookieUser?.authenticated === true) {
//             user = cookieUser;
//             event.locals = { user, appConfig, code: cookieCode };
//             const response = await resolve(event);

//             // Delete the code cookie
//             if (cookieUser) {
//                 response.headers.append('set-cookie', cookie.serialize('c', '', { path: '/', httpOnly: true, expires: new Date(new Date().getTime() - 100000) }));
//             } else {
//                 /* Already deleted */
//             }

//             return addSecurityHeaders(response);
//         } else {
//             //-console.log(`handle cookieUser not authenticated, redirecting`);
//             event.locals = { user, appConfig };
//             const response = await handleNotAuthenticatedButNeedToBe(event, appConfig);
//             return addSecurityHeaders(response);
//         }
//     }
//     // Already returned in each branch
// };

// function addSecurityHeaders(response: Response): Response {
//     response.headers.append('X-Content-Type-Options', 'nosniff');
//     response.headers.append('Referrer-Policy', 'strict-origin-when-cross-origin');
//     response.headers.append('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
//     response.headers.append(
//         'Permissions-Policy',
//         'accelerometer=(), camera=(), document-domain=(), encrypted-media=(), gyroscope=(), ' +
//             'interest-cohort=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), ' +
//             'publickey-credentials-get=(), sync-xhr=(), usb=(), xr-spatial-tracking=(), geolocation=()',
//     );

//     return response;
// }
