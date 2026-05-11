# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: blu_v3.test.js >> BLU UAT
- Location: tests/blu_v3.test.js:450:1

# Error details

```
Test timeout of 300000ms exceeded.
```

```
Error: page.waitForTimeout: Test timeout of 300000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - img "Bajaj Finance Logo" [ref=e5] [cursor=pointer]
    - generic [ref=e7]:
      - heading "Blu" [level=1] [ref=e8]
      - img "Blu Logo" [ref=e9]
  - generic [ref=e10]:
    - generic [ref=e11]:
      - img "image" [ref=e14]
      - generic [ref=e16]:
        - paragraph [ref=e17]: 👋 I'm Blu - your Bajaj Finserv AI assistant
        - paragraph [ref=e18]:
          - img "image" [ref=e19]
          - text: Secured
    - generic [ref=e20]:
      - img "image" [ref=e23]
      - paragraph [ref=e25]:
        - text: Hi, I’m Blu!
        - text: You can ask me all your questions related to Bajaj Finserv products and services.
      - paragraph [ref=e27]: Please enter your mobile number.
    - paragraph [ref=e30]: "9551898507"
    - generic [ref=e31]:
      - img "image" [ref=e34]
      - paragraph [ref=e36]: Please provide your 6 digit otp.
      - generic [ref=e37]: 01:29 remaining
      - generic [ref=e39]:
        - button "Change mobile number" [disabled] [ref=e40]
        - button "Resend OTP" [disabled] [ref=e41]
    - paragraph [ref=e44]: "123465"
    - generic [ref=e45]:
      - img "image" [ref=e48]
      - paragraph [ref=e50]: Your OTP has been successfully validated.
    - generic [ref=e51]:
      - img "image" [ref=e54]
      - paragraph [ref=e56]: We request you to read our terms of service and accept by selecting the checkbox below.
      - generic [ref=e59]:
        - generic [ref=e66]:
          - text: I have read, understood and hereby accept the
          - link "Privacy policy" [ref=e67] [cursor=pointer]:
            - /url: javascript:void(0)
          - text: and
          - link "Terms of use" [ref=e68] [cursor=pointer]:
            - /url: javascript:void(0)
          - text: . *
        - button "Accept and Continue" [disabled] [ref=e71]
    - paragraph [ref=e74]: Accept and Continue
    - generic [ref=e75]:
      - img "image" [ref=e78]
      - paragraph [ref=e80]: Hi User Welcome to Blu Chatbot..! What would you like to do today?
    - paragraph [ref=e83]: Explain
    - generic [ref=e84]:
      - img "image" [ref=e87]
      - paragraph [ref=e89]:
        - text: "- The chat history shows an initial interaction with the Bajaj Finserv chatbot."
        - text: "- The user is prompted to enter their mobile number and a one-time password (OTP) for verification."
        - text: "- After verification, the chatbot welcomes the user and offers further assistance."
        - text: "- If you have specific questions about Bajaj Finserv products or services, feel free to ask!"
    - paragraph [ref=e92]: do i need kyc for emi transactions?
    - generic [ref=e93]:
      - img "image" [ref=e96]
      - paragraph [ref=e98]: Yes, a minimum KYC is required to create your Bajaj Pay Wallet, which is mandatory for getting the Insta EMI Card. This ensures a secure and smooth transaction experience! 😊 If you have more questions, feel free to ask!
    - paragraph [ref=e101]: Call me
    - generic [ref=e102]:
      - img "image" [ref=e105]
      - paragraph [ref=e107]: Thanks for reaching out! I’m here to help you with your queries through chat. I’ll do my best to assist you right here with accurate information and guidance.
    - paragraph [ref=e110]: Can u show multiple loan detail I am not getting a loan amount
    - generic [ref=e111]:
      - img "image" [ref=e114]
      - paragraph [ref=e116]: Please select the relation to move further
      - list [ref=e118]:
        - listitem [ref=e119]:
          - generic [ref=e121]:
            - generic [ref=e122]: Active
            - generic [ref=e123]:
              - generic [ref=e124]: PERSONAL LOAN
              - generic [ref=e125]: "Disbursal date: 22/10/2023"
            - generic [ref=e126]:
              - generic [ref=e127]:
                - generic [ref=e128]: Loan amount
                - generic [ref=e129]: ₹1392392
              - button [disabled] [ref=e131]
        - listitem [ref=e136]:
          - generic [ref=e138]:
            - generic [ref=e139]: Closed
            - generic [ref=e140]:
              - generic [ref=e141]: PERSONAL LOAN
              - generic [ref=e142]: "Disbursal date: 22/10/2023"
            - generic [ref=e143]:
              - generic [ref=e144]:
                - generic [ref=e145]: Loan amount
                - generic [ref=e146]: ₹1392392
              - button [disabled] [ref=e148]
    - paragraph [ref=e155]:
      - text: PERSONAL LOAN
      - text: "Disbursal date: 22/10/2023"
    - generic [ref=e156]:
      - img "image" [ref=e159]
      - generic [ref=e160]:
        - generic [ref=e161]:
          - img "image" [ref=e165]
          - generic [ref=e167]:
            - generic [ref=e168]:
              - paragraph [ref=e169]: We’re facing a temporary issue
              - paragraph [ref=e170]: We ran into a temporary issue while processing your request.
            - paragraph [ref=e172]: Please click on retry to continue.
        - button "Retry" [disabled] [ref=e177]
    - paragraph [ref=e180]: Retry
    - generic [ref=e181]:
      - img "image" [ref=e184]
      - paragraph [ref=e186]: To view multiple loan details, please check the Loan details page using the link below.
      - generic [ref=e188]:
        - generic [ref=e190]: View your loan information and options.
        - button "Loan details page" [disabled] [ref=e192]
    - paragraph [ref=e195]: you write and tell the number
    - generic [ref=e196]:
      - img "image" [ref=e199]
      - paragraph [ref=e201]:
        - text: "Please specify the type of loan you're interested in from the options below:"
        - text: "- Car Loan (New, Used, Balance Transfer, Top-Up, Loan Against Car)"
        - text: "- Home Loan (Salaried, Self-Employed, Balance Transfer)"
        - text: "- Personal Loan"
        - text: "- Business Loan (Unsecured, Secured)"
        - text: "- Two-Wheeler Loan"
        - text: "- Gold Loan"
        - text: "- Loan Against Property"
        - text: "- Loan Against Fixed Deposit"
        - text: "- Loan Against Insurance Policy"
        - text: "- Loan Against Mutual Funds"
        - text: "- Loan Against Shares"
        - text: Let me know your preference!
      - generic [ref=e203]:
        - button "what is loan against property?" [ref=e204]
        - button "what are the interest rates for loan against property?" [ref=e205]
        - button "how to apply for loan against property?" [ref=e206]
  - generic [ref=e209]:
    - textbox "Ask Blu a question" [active] [ref=e211]
    - paragraph [ref=e213]: I'm an AI bot and can make mistakes. Please independently verify the information provided.
```

# Test source

```ts
  32  |     /you('ll| will) need/i,
  33  |     /please provide/i,
  34  |     /provide.*loan amount/i,
  35  |     /specify.*product/i,
  36  |     /which.*loan/i,
  37  |     /select.*variant/i,
  38  |     /flexi hybrid/i,
  39  |     /chahiye/i,
  40  |     /chahiye hongi/i,
  41  |     /details chahiye/i,
  42  |     /batayein/i,
  43  |     /bataiye/i,
  44  |     /provide karein/i,
  45  |   ];
  46  |   
  47  |   return followUpPatterns.some(p => p.test(botReply));
  48  | }
  49  | 
  50  | function generateFollowUpData(botReply) {
  51  |   const lower = botReply.toLowerCase();
  52  |   
  53  |   if (lower.includes('variant')) {
  54  |     return 'Flexi Hybrid Term Loan';
  55  |   }
  56  |   
  57  |   if (lower.includes('specify') || lower.includes('which')) {
  58  |     if (lower.includes('product') || lower.includes('loan')) {
  59  |       return 'Personal Loan';
  60  |     }
  61  |   }
  62  |   
  63  |   if (lower.includes('you') && lower.includes('need')) {
  64  |     return 'Loan amount 5 lakh, interest rate 12%, tenure 3 years';
  65  |   }
  66  |   
  67  |   if (lower.includes('loan amount') || lower.includes('interest') || lower.includes('tenure') || lower.includes('chahiye')) {
  68  |     return 'Loan amount 5 lakh, interest rate 12%, tenure 3 years';
  69  |   }
  70  |   
  71  |   return null;
  72  | }
  73  | 
  74  | async function screenshot(page, label) {
  75  |   const p = `results/screenshots/${label}_${Date.now()}.png`;
  76  |   await page.screenshot({ path: p, fullPage: true }).catch(() => {});
  77  |   console.log(`  📸 ${p}`);
  78  |   return p;
  79  | }
  80  | 
  81  | async function clearAndType(page, locator, text) {
  82  |   await locator.waitFor({ state: 'visible', timeout: 30000 });
  83  |   await locator.scrollIntoViewIfNeeded().catch(() => {});
  84  |   await locator.click({ force: true });
  85  |   await page.keyboard.press('Meta+A');
  86  |   await page.keyboard.press('Backspace');
  87  |   await page.keyboard.type(text, { delay: 12 });
  88  | }
  89  | 
  90  | async function submitFromComposer(page, locator) {
  91  |   const method = await locator.evaluate(el => {
  92  |     let node = el;
  93  |     for (let i = 0; i < 9; i++) {
  94  |       const parent = node?.parentElement;
  95  |       if (!parent) break;
  96  |       for (const b of parent.querySelectorAll('button')) {
  97  |         if (!b.disabled) { b.click(); return 'button'; }
  98  |       }
  99  |       const rb = parent.querySelector('[role="button"]');
  100 |       if (rb) { rb.click(); return 'role-button'; }
  101 |       for (const img of parent.querySelectorAll('img')) {
  102 |         if (window.getComputedStyle(img).cursor === 'pointer') {
  103 |           img.click(); return 'img-pointer';
  104 |         }
  105 |       }
  106 |       const imgs = parent.querySelectorAll('img');
  107 |       if (imgs.length) { imgs[imgs.length - 1].click(); return 'img-last'; }
  108 |       node = parent;
  109 |     }
  110 |     return null;
  111 |   }).catch(() => null);
  112 |   if (!method) { await locator.press('Enter').catch(() => {}); return 'enter'; }
  113 |   return method;
  114 | }
  115 | 
  116 | async function dismissRetry(page) {
  117 |   const btn = page.getByRole('button', { name: /^Retry$/i }).first();
  118 |   let attempts = 0;
  119 |   
  120 |   while (await btn.isVisible().catch(() => false) && attempts < 20) {
  121 |     // Check if clickable (not in 30s cooldown)
  122 |     const isEnabled = await btn.isEnabled().catch(() => false);
  123 |     
  124 |     if (isEnabled) {
  125 |       console.log(`  🟠 Retry clickable, dismissing...`);
  126 |       await btn.click({ force: true });
  127 |       await page.waitForTimeout(2000);
  128 |       attempts++;
  129 |     } else {
  130 |       // In cooldown, wait 2s and check again
  131 |       console.log(`  ⏳ Retry in cooldown, waiting...`);
> 132 |       await page.waitForTimeout(2000);
      |                  ^ Error: page.waitForTimeout: Test timeout of 300000ms exceeded.
  133 |       attempts++;
  134 |     }
  135 |     
  136 |     if (attempts >= 20) {
  137 |       console.log(`  ⚠️  Retry never became clickable after 40s`);
  138 |       break;
  139 |     }
  140 |   }
  141 | }
  142 | 
  143 | async function isConsentPending(page) {
  144 |   return await page.evaluate(() => {
  145 |     const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  146 |     return checkboxes.some(cb => !cb.checked);
  147 |   }).catch(() => false);
  148 | }
  149 | 
  150 | async function acceptConsent(page, attempt) {
  151 |   const pending = await isConsentPending(page);
  152 |   if (!pending) return false;
  153 | 
  154 |   const checkbox  = page.locator('input[type="checkbox"]').first();
  155 |   const acceptBtn = page.locator('button.blu-primary-button').last();
  156 | 
  157 |   await checkbox.scrollIntoViewIfNeeded().catch(() => {});
  158 |   await page.waitForTimeout(300);
  159 | 
  160 |   const box = await checkbox.boundingBox().catch(() => null);
  161 |   if (box) {
  162 |     await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  163 |   } else {
  164 |     await checkbox.click({ force: true }).catch(() => {});
  165 |   }
  166 |   await page.waitForTimeout(400);
  167 | 
  168 |   const checked = await checkbox.evaluate(el => el.checked).catch(() => false);
  169 |   if (!checked) {
  170 |     await checkbox.evaluate(el => {
  171 |       el.checked = true;
  172 |       el.dispatchEvent(new Event('input',  { bubbles: true }));
  173 |       el.dispatchEvent(new Event('change', { bubbles: true }));
  174 |       el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  175 |     }).catch(() => {});
  176 |     await page.waitForTimeout(400);
  177 |   }
  178 | 
  179 |   for (let w = 0; w < 6; w++) {
  180 |     await page.waitForTimeout(500);
  181 |     if (await acceptBtn.isEnabled().catch(() => false)) break;
  182 |   }
  183 | 
  184 |   await acceptBtn.scrollIntoViewIfNeeded().catch(() => {});
  185 |   await acceptBtn.click({ force: true });
  186 |   await page.waitForTimeout(2500);
  187 |   await dismissRetry(page);
  188 |   return true;
  189 | }
  190 | 
  191 | async function isInitialHomeReady(page) {
  192 |   const chipsVisible = await page
  193 |     .locator('text=What you can do next').first()
  194 |     .isVisible().catch(() => false);
  195 |   if (!chipsVisible) return false;
  196 | 
  197 |   const composerVisible = await page
  198 |     .locator('textarea, [contenteditable="true"]').first()
  199 |     .isVisible().catch(() => false);
  200 |   if (!composerVisible) return false;
  201 | 
  202 |   if (await page.getByRole('button', { name: /^Retry$/i }).first()
  203 |     .isVisible().catch(() => false)) return false;
  204 | 
  205 |   if (await isConsentPending(page)) return false;
  206 | 
  207 |   return true;
  208 | }
  209 | 
  210 | async function waitForHome(page) {
  211 |   await Promise.race([
  212 |     page.locator('input[type="checkbox"]').first()
  213 |       .waitFor({ state: 'attached', timeout: 15000 }),
  214 |     page.locator('text=What you can do next').first()
  215 |       .waitFor({ state: 'visible', timeout: 15000 }),
  216 |   ]).catch(() => {});
  217 | 
  218 |   for (let i = 1; i <= 20; i++) {
  219 |     await dismissRetry(page);
  220 |     if (await isInitialHomeReady(page)) {
  221 |       console.log(`  ✅ Home (${i})`);
  222 |       return;
  223 |     }
  224 |     if (await isConsentPending(page)) {
  225 |       await acceptConsent(page, i);
  226 |     } else {
  227 |       await page.waitForTimeout(1000);
  228 |     }
  229 |   }
  230 | 
  231 |   await screenshot(page, 'fail_home');
  232 |   throw new Error('Home not reached');
```