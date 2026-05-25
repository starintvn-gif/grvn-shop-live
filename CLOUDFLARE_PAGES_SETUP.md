# Cloudflare Pages: Setup & Deployment

This repository includes a GitHub Actions workflow to deploy the site to Cloudflare Pages using Wrangler.

Steps to enable automatic Pages deployment:

1. Create a Cloudflare API Token
   - Go to your Cloudflare dashboard -> My Profile -> API Tokens -> Create Token
   - Use the "Edit Cloudflare Workers" or custom template with permissions for Pages/Workers (Pages: Edit or full Pages permissions).
   - Limit the token to the specific account and resources if possible.

2. Add the token to this repository's Secrets
   - In GitHub: Settings -> Secrets and variables -> Actions -> New repository secret
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: the token you created

3. Verify the `project-name` in the workflow
   - The workflow file `.github/workflows/deploy-cloudflare-pages.yml` uses `--project-name=grvn-shop-live`.
   - If your Pages project has a different name, update the workflow accordingly.

4. Re-link or correct the Pages project in Cloudflare (if currently attached to Workers)
   - Open Cloudflare dashboard -> Pages -> Select the Pages project (e.g., `grvn-shop-live`).
   - In Project settings -> Repository, ensure the connected Git provider + repository is `starintvn-gif/grvn-shop`.
   - If it is linked incorrectly (e.g., a Workers subproject), you can disconnect and re-create the Pages project and choose GitHub as provider.

5. Trigger a deployment
   - Push to `main` branch in this repository to trigger the workflow.

Notes & troubleshooting
- If you prefer Cloudflare's native GitHub integration instead of a workflow, you can connect the repo directly from the Pages UI.
- To remove a mistaken Workers binding, go to Workers & Pages list in Cloudflare and delete or edit the incorrect entry.
- If builds fail, check the workflow logs in GitHub Actions and the Pages build logs in Cloudflare.
