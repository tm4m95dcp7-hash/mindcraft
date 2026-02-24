import Groq from 'groq-sdk'
import { getKey, hasKey } from '../utils/keys.js';

// THIS API IS NOT TO BE CONFUSED WITH GROK!
// Go to grok.js for that. :)

// Umbrella class for everything under the sun... That GroqCloud provides, that is.
export class GroqCloudAPI {
    static prefix = 'groq';

    constructor(model_name, url, params) {

        this.model_name = model_name;
        this.url = url;
        this.params = params || {};

        // Remove any mention of "tools" from params:
        if (this.params.tools)
            delete this.params.tools;
        // This is just a bit of future-proofing in case we drag Mindcraft in that direction.

        // I'm going to do a sneaky ReplicateAPI theft for a lot of this, aren't I?
        if (this.url)
            console.warn("Groq Cloud has no implementation for custom URLs. Ignoring provided URL.");

        // Load all available API keys (GROQCLOUD_API_KEY, GROQCLOUD_API_KEY_2, GROQCLOUD_API_KEY_3, ...)
        this.apiKeys = [getKey('GROQCLOUD_API_KEY')];
        for (let i = 2; i <= 10; i++) {
            if (hasKey(`GROQCLOUD_API_KEY_${i}`)) {
                this.apiKeys.push(getKey(`GROQCLOUD_API_KEY_${i}`));
            }
        }
        this.currentKeyIndex = 0;
        console.log(`[Groq] Loaded ${this.apiKeys.length} API key(s).`);
        this.groq = new Groq({ apiKey: this.apiKeys[0] });
    }

    _rotateKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
        this.groq = new Groq({ apiKey: this.apiKeys[this.currentKeyIndex] });
        console.warn(`[Groq] Switched to API key ${this.currentKeyIndex + 1}/${this.apiKeys.length}.`);
    }

    async sendRequest(turns, systemMessage, stop_seq = null) {
        // Construct messages array
        let messages = [{"role": "system", "content": systemMessage}].concat(turns);

        // Handle deprecated max_tokens parameter (do once, not per attempt)
        if (this.params.max_tokens) {
            console.warn("GROQCLOUD WARNING: A profile is using `max_tokens`. This is deprecated. Please move to `max_completion_tokens`.");
            this.params.max_completion_tokens = this.params.max_tokens;
            delete this.params.max_tokens;
        }
        if (!this.params.max_completion_tokens) {
            this.params.max_completion_tokens = 4000;
        }

        // Try each key once before giving up
        for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
            try {
                console.log(`[Groq] Awaiting response (key ${this.currentKeyIndex + 1}/${this.apiKeys.length})...`);

                let completion = await this.groq.chat.completions.create({
                    "messages": messages,
                    "model": this.model_name || "qwen/qwen3-32b",
                    "stream": false,
                    "stop": stop_seq,
                    ...(this.params || {})
                });

                let res = completion.choices[0].message.content;
                res = res.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                return res;
            }
            catch(err) {
                if (err.status === 429) {
                    console.warn(`[Groq] Key ${this.currentKeyIndex + 1} is rate limited.`);
                    if (attempt < this.apiKeys.length - 1) {
                        this._rotateKey();
                    } else {
                        console.error('[Groq] All API keys are rate limited.');
                        return "All API keys are rate limited, please try again later.";
                    }
                } else if (err.message && err.message.includes("content must be a string")) {
                    return "Vision is only supported by certain models.";
                } else {
                    console.error('[Groq] Unexpected error:', err);
                    return "My brain disconnected, try again.";
                }
            }
        }
    }

    async sendVisionRequest(messages, systemMessage, imageBuffer) {
        const imageMessages = messages.filter(message => message.role !== 'system');
        imageMessages.push({
            role: "user",
            content: [
                { type: "text", text: systemMessage },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
                    }
                }
            ]
        });

        return this.sendRequest(imageMessages);
    }

    async embed(_) {
        throw new Error('Embeddings are not supported by Groq.');
    }
}
