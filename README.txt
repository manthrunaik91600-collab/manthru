MAN THRU — CLEAN PROJECT PACKAGE

This package is based on the uploaded manthru-main project. The active standalone frontend is root index.html and server.js serves dist/index.html when a dist build exists, otherwise root index.html. Render's build should therefore build from this updated root index.html.

Changes included in index.html:
- New versioned 20-message batch counter key to avoid old 15-message counter values being reused.
- 15-minute cooldown remains in effect after every 20 message actions; the timer is not restarted by duplicate stepper callbacks.
- Current search results are saved per signed-in mobile number and restored after refresh. Contacted status is saved, and the stepper filters out contacted businesses so it resumes at the next uncontacted result.
- New searches are blocked while the current search still has uncontacted results. A new search is allowed once the current list is completed.
- Login/Register modal is shown before UI refresh work, so an update error cannot hide the modal.
- October 13 is mapped to International Day for Disaster Risk Reduction; fallback day-of-year calculation is timezone-stable.
- Daily sent count is no longer cleared simply by refreshing the page.

Deploy to Render:
- Keep the existing Render service and environment variables.
- Use the same configured Build Command and Start Command as before.
- Root index.html is the source frontend; if `npm run build` creates dist/index.html, it will be generated from this updated index.html.
- Do not commit real API keys. Configure them in Render Environment settings.

Validation:
- Inline JavaScript syntax checks passed with Node.js `node --check`.
- server.js syntax check passed with Node.js `node --check`.
- A full npm install/build and live Render browser test were not completed in this environment. Verify after deployment before deleting your backup.
