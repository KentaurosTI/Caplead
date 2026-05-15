const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Specialist UI/UX Service
 * Wrapper for the ui-ux-pro-max expert skill.
 */
class UXExpert {
    constructor() {
        // Path to the skill in the Antigravity directory
        this.skillPath = 'C:\\Users\\mathe\\.gemini\\antigravity\\skills\\ui-ux-pro-max';
        this.scriptPath = path.join(this.skillPath, 'scripts', 'search.py');
    }

    /**
     * Generates a complete design system recommendation for a specific niche.
     * @param {string} niche - The niche/industry of the lead (e.g., "Dentista", "Advogado").
     * @returns {Promise<string>} - Markdown formatted design guidelines.
     */
    async generateDesignSystem(niche) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(this.scriptPath)) {
                console.warn(`[UXExpert] Specialist script not found at ${this.scriptPath}. Falling back to basic design.`);
                return resolve(this.getFallbackGuidelines(niche));
            }

            // Command: py <script> <query> --design-system --format markdown
            const command = `py "${this.scriptPath}" "${niche}" --design-system --format markdown`;
            const options = {
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            };

            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[UXExpert] Error executing specialist script: ${error.message}`);
                    return resolve(this.getFallbackGuidelines(niche));
                }
                
                if (stdout) {
                    resolve(stdout.trim());
                } else {
                    resolve(this.getFallbackGuidelines(niche));
                }
            });
        });
    }

    /**
     * Fallback guidelines in case the expert script fails.
     */
    getFallbackGuidelines(niche) {
        return `
### Design System: ${niche.toUpperCase()} (Fallback)
- **Style:** Clean & Modern Professional
- **Colors:** Primary: #2563EB, CTA: #F97316
- **Typography:** Sans-serif (Inter/Roboto)
- **Checklist:** Mobile responsive, readable contrast, fast loading.
        `.trim();
    }
}

module.exports = new UXExpert();
