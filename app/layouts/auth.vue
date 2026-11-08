<template>
  <div class="auth-layout">
    <a class="skip-link" href="#main">Перейти к форме</a>
    <BrandPanel />
    <main id="main" class="auth-main">
      <p class="auth-eyebrow">ДОСТУП К ПЛАТФОРМЕ</p>
      <slot />
      <p class="auth-footer"><span class="desktop-only">Школьные события · пилот Свердловской области · 2026</span><span class="compact-only">Сбер × УрФУ · Пилот для педагогов Свердловской области</span></p>
    </main>
  </div>
</template>
