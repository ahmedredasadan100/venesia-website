import assert from 'node:assert/strict';
import {expect} from 'playwright/test';

// Test-only adapter for two current menu consumers. Product ownership remains
// AdminDataGridRowActions; all other domain recipes keep the inline contract.
export function createCoreDomainVisibilityControl({page,recipe,timeout=60_000}){
 assert.ok(Number.isSafeInteger(recipe.id)&&recipe.id>0);
 const menuContract=recipe.entity==='redirects'?{entityType:'redirect',states:['نشط','غير نشط']}
  :recipe.entity==='admin_users'?{entityType:'admin_user',states:['نشط','موقوف']}:null;
 const inline=page.locator('[data-admin-row-action="visibility"][data-admin-entity-id="'+recipe.id+'"] button');
 const identity=menuContract?'[data-admin-row-action="more"][data-admin-entity-type="'+menuContract.entityType+'"][data-admin-entity-id="'+recipe.id+'"]':null;
 const more=menuContract?page.locator(identity+' button'):null;
 const row=menuContract?page.locator('table tbody tr[data-entity-row-id="'+recipe.id+'"]').filter({has:page.locator(identity)}):null;
 const status=menuContract?row.locator('span.rounded-full').filter({hasText:new RegExp('^(?:'+menuContract.states.join('|')+')$')}):null;
 const menu=menuContract?page.locator('[data-admin-row-actions-menu][data-admin-entity-type="'+menuContract.entityType+'"][data-admin-entity-id="'+recipe.id+'"]'):null;
 const item=menuContract?menu.locator('[data-admin-row-action-menu-item="visibility"]'):inline;
 async function readState(){
  if(!menuContract){await expect(inline).toHaveCount(1,{timeout});const value=await inline.getAttribute('aria-pressed');assert.ok(value==='true'||value==='false','The mounted inline state is required.');return value;}
  await expect(inline).toHaveCount(0);await expect(row).toHaveCount(1,{timeout});await expect(more).toHaveCount(1);await expect(status).toHaveCount(1);
  const value=(await status.innerText()).trim();assert.ok(menuContract.states.includes(value));return value===menuContract.states[0]?'true':'false';
 }
 async function expectState(value){
  assert.ok(value==='true'||value==='false');
  if(!menuContract){await expect(inline).toHaveAttribute('aria-pressed',value,{timeout});return;}
  await expect(row).toHaveCount(1,{timeout});await expect(status).toHaveCount(1);await expect(status).toHaveText(menuContract.states[value==='true'?0:1],{timeout});
 }
 async function prepare(){
  if(!menuContract){await expect(inline).toHaveCount(1,{timeout});return inline;}
  await readState();await expect(more).toBeEnabled({timeout});
  if(await menu.count()===0)await more.click();
  await expect(menu).toHaveCount(1,{timeout});const value=await readState();await expect(item).toHaveCount(1);await expect(item).toHaveText(value==='true'?'إخفاء':'إظهار');assert.equal(await item.getAttribute('aria-pressed'),null,'Menu commands do not expose inline toggle semantics.');return item;
 }
 async function closeMenu(){if(menuContract&&await menu.count()){await page.keyboard.press('Escape');await expect(menu).toHaveCount(0,{timeout});}}
 async function expectEnabled(){const target=await prepare();await expect(target).toBeEnabled({timeout});await closeMenu();}
 async function invoke(){const target=await prepare();await expect(target).toBeEnabled({timeout});await target.click();}
 async function expectReturnedFocus(){await expect(menuContract?more:inline).toBeFocused({timeout});}
 async function assertPendingDuplicateBlocked(postCount){
  assert.equal(typeof postCount,'function');const before=postCount(),target=await prepare();await expect(target).toBeDisabled({timeout});
  if(menuContract){await expect(target).toHaveAttribute('aria-disabled','true');await expect(target).toHaveAttribute('aria-busy','true');}
  await target.evaluate(button=>button.click());
  assert.equal(postCount(),before,'Disabled pending visibility must not dispatch an extra command.');await closeMenu();
 }
 return{presentation:menuContract?'menu':'inline',failedConfirmation:recipe.entity==='admin_users'?'closed':'retained',readState,expectState,expectEnabled,invoke,expectReturnedFocus,assertPendingDuplicateBlocked};
}
