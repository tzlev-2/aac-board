import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PCS_AVAILABLE_IDS } from '$lib/gridset/pcs-manifest';

/**
 * ‏`GET /img/pcs/<id>` — מגיש סמל PCS מתוך דלי R2, **באותו origin**.
 *
 * ## למה נתיב-שרת ולא קבצים ב-`static/`
 *
 * ‏🔑 **אותו origin הוא כל העניין.** הסמל נצרך דרך `<img src>`
 * (‏`ButtonCell.svelte`), ולכן אם הוא היה מוגש מדומיין אחר מאחורי
 * ‏Access — הבקשה הייתה **subresource חוצה-אתר**, והקוקי של Access נחסם
 * ב-Safari וב-Firefox כברירת-מחדל. כאן אין שאלה כזו: אותה כתובת, אותה
 * כניסה, עובד בכל דפדפן.
 *
 * ומול העתקה ל-`static/`: הדלי נשאר **מקור-אמת יחיד**, ובייטים מורשים
 * אינם משוכפלים לתוך כל ארטיפקט-בילד.
 *
 * ## 🛑 תלות בקונפיג שאינו בקובץ הזה
 *
 * דורש binding בשם **`PCS_ASSETS`** אל הדלי `aac-assets`. ראו
 * [`../README.md`](../README.md) — שם כתוב איפה הוא מוצהר ואיך מחילים אותו.
 *
 * **בלי ה-binding הנתיב מחזיר 404**, והפותר נופל ל-ARASAAC. זו התנהגות
 * מכוונת: בילד בלי גישה לדלי **אינו** מתחיל להגיש תוכן מורשה.
 */
export const GET: RequestHandler = async ({ params, platform, setHeaders }) => {
	const id = params.id;

	// 🛑 שער לפני ה-R2: רק מזהה שבמניפסט. מונע מעבר-נתיב ומונע סריקה של
	// הדלי דרך מזהים מנוחשים — המניפסט מיוצר מרשימת האובייקטים בדלי עצמו.
	if (!PCS_AVAILABLE_IDS.has(id)) throw error(404, 'מזהה PCS אינו במניפסט');

	const bucket = platform?.env?.PCS_ASSETS;
	if (!bucket) throw error(404, 'אין binding ל-PCS_ASSETS');

	const obj = await bucket.get(`img/pcs/${id}.png`);
	if (!obj) throw error(404, 'הסמל אינו בדלי');

	// הסמלים אינם משתנים — המזהה הוא התוכן.
	setHeaders({ 'cache-control': 'public, max-age=31536000, immutable' });
	return new Response(obj.body, {
		headers: { 'content-type': 'image/png' }
	});
};
