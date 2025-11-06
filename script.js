/* 
    VLESS to Xray JSON Converter
    Author: Givonar (https://github.com/Givonar/v2rayconfig2xrayjson)
    All logic performed client-side.
*/

/**
 * Parses a VLESS link and converts it to Xray JSON Config
 * @param {string} url VLESS link
 * @returns {object} { json, remark, valid, error }
 */
function parseVLESS(url) {
    const result = { json: null, remark: '', valid: false, error: '' };

    // Basic VLESS URL validation and extraction
    const linkRegex = /^vless:\/\/([a-f0-9\-]{36})@([^:\/?#]+):(\d+)\?([^#]*)(?:#(.+))?$/i;
    const m = url.trim().match(linkRegex);
    if (!m) {
        result.error = "Malformed VLESS link — check the format and try again.";
        return result;
    }

    // Extract core parts
    const uuid = m[1];
    const address = m[2];
    const port = m[3];
    const query = m[4] || '';
    const remarkRaw = m[5] || '';
    result.remark = decodeURIComponent(remarkRaw.replace(/\+/g, ' '));

    // Parse query params (security, type, path, host, headerType, etc.)
    const params = {};
    query.split('&').forEach(q => {
        const [k, v] = q.split('=');
        if (k) params[k] = v !== undefined ? decodeURIComponent(v) : '';
    });

    // Minimal validation of required params
    // security, type, etc, are optional, but 'type' is commonly expected.
    const networkType = params.type || 'tcp';

    // Compose Xray JSON config object
    // This is a minimal inbound/outbound config, suitable for most Xray/V2Ray apps
    const json = {
        "inbounds": [],
        "outbounds": [
            {
                "protocol": "vless",
                "settings": {
                    "vnext": [
                        {
                            "address": address,
                            "port": Number(port),
                            "users": [
                                {
                                    "id": uuid,
                                    "encryption": params.security || "none",
                                    "flow": params.flow || undefined
                                }
                            ]
                        }
                    ]
                },
                "streamSettings": {
                    "network": networkType,
                    // Dynamically construct according to network type
                    ...(networkType === 'tcp' && params.headerType
                        ? { "tcpSettings": { "header": { "type": params.headerType } } }
                        : {}),
                    ...(networkType === 'ws'
                        ? { "wsSettings": {
                                "path": params.path || "",
                                "headers": params.host ? { "Host": params.host } : {}
                            } }
                        : {}),
                    ...(networkType === 'grpc'
                        ? { "grpcSettings": {
                                "serviceName": params.serviceName || "",
                                "multiMode": params.mode === "multi" ? true : false,
                                "headers": params.host ? { "Host": params.host } : {}
                            } }
                        : {})
                },
                "tag": result.remark || "out_" + address
            }
        ]
    };

    // Clean up undefined fields (especially inside users array)
    for (const u of json.outbounds[0].settings.vnext[0].users) {
        Object.keys(u).forEach(key => u[key] === undefined && delete u[key]);
    }
    // Remove empty streamSettings fields if necessary
    // (avoid Host being blank, etc)

    result.json = json;
    result.valid = true;
    return result;
}

// UI Elements
const vlessInput = document.getElementById('vlessInput');
const convertBtn = document.getElementById('convertBtn');
const jsonOutput = document.getElementById('jsonOutput');
const validationMessage = document.getElementById('validationMessage');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');

// Conversion Handler
convertBtn.addEventListener('click', () => {
    const vlessLink = vlessInput.value.trim();
    validationMessage.textContent = '';
    jsonOutput.textContent = '';
    if (!vlessLink) {
        validationMessage.textContent = 'Please paste a VLESS link above.';
        return;
    }
    const result = parseVLESS(vlessLink);
    if (!result.valid) {
        validationMessage.textContent = result.error;
        jsonOutput.textContent = '';
        jsonOutput.classList.add('error');
        return;
    }
    validationMessage.textContent = '';
    jsonOutput.classList.remove('error');
    // Pretty print JSON
    jsonOutput.textContent = JSON.stringify(result.json, null, 2);
});

// Copy Button Handler
copyBtn.addEventListener('click', () => {
    const text = jsonOutput.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = "Copy", 1200);
    }).catch(() => {
        copyBtn.textContent = "Failed :(";
        setTimeout(() => copyBtn.textContent = "Copy", 1200);
    });
});

// Save/Export Button Handler
saveBtn.addEventListener('click', () => {
    const text = jsonOutput.textContent;
    if (!text) return;
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "vless_xray_config.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 800);
});

// Validate as user types (Bonus)
vlessInput.addEventListener('input', () => {
    const vlessLink = vlessInput.value.trim();
    if (!vlessLink) {
        validationMessage.textContent = '';
        return;
    }
    const result = parseVLESS(vlessLink);
    if (!result.valid) {
        validationMessage.textContent = result.error;
        jsonOutput.textContent = '';
        jsonOutput.classList.add('error');
    } else {
        validationMessage.textContent = '';
        jsonOutput.classList.remove('error');
    }
});
