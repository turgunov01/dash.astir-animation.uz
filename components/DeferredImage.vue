<script setup lang="ts">
// Regulated image loading: the request only fires when the image is near the
// viewport (IntersectionObserver) AND a concurrency slot is free (acquireImageSlot),
// so at most a few posters decode at once instead of all of them freezing the page.
const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  fallbackSrc?: string
  rootMargin?: string
}>(), { src: '', alt: '', fallbackSrc: '', rootMargin: '300px' })

const root = ref<HTMLImageElement | null>(null)
const shouldLoad = ref(false)
const loaded = ref(false)
const failed = ref(false)
const usingFallback = ref(false)

// Primary src is the (small) thumbnail; on error we retry once with fallbackSrc.
const activeSrc = computed(() => (usingFallback.value && props.fallbackSrc) ? props.fallbackSrc : props.src)
let observer: IntersectionObserver | null = null
let slot: ImageSlot | null = null
let destroyed = false

function stopObserver() {
  observer?.disconnect()
  observer = null
}

function releaseSlot() {
  if (slot) {
    slot.release()
    slot = null
  }
}

async function beginLoad() {
  if (!activeSrc.value || shouldLoad.value || slot) return

  slot = acquireImageSlot()
  await slot.promise

  // The component may have unmounted or swapped src while waiting for a slot.
  if (destroyed || !activeSrc.value) {
    releaseSlot()
    return
  }

  shouldLoad.value = true
}

function startObserver() {
  if (!activeSrc.value) return

  // Already loaded this session → it's in the browser cache; render instantly,
  // bypassing the observer and the concurrency queue (no reload, no hang).
  if (isImageLoaded(activeSrc.value)) {
    shouldLoad.value = true
    return
  }

  // No IntersectionObserver (very old browser / SSR edge): load right away.
  if (typeof IntersectionObserver === 'undefined') {
    void beginLoad()
    return
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      stopObserver()
      void beginLoad()
    }
  }, { rootMargin: props.rootMargin })

  if (root.value) observer.observe(root.value)
}

function onLoad() {
  loaded.value = true
  markImageLoaded(activeSrc.value)
  releaseSlot()
}

function onError() {
  releaseSlot()

  // Thumbnail failed (e.g. /media-thumb not deployed yet): retry with the original.
  if (props.fallbackSrc && !usingFallback.value && props.fallbackSrc !== props.src) {
    usingFallback.value = true
    loaded.value = false
    shouldLoad.value = false
    void beginLoad()
    return
  }

  failed.value = true
}

onMounted(startObserver)

watch(() => props.src, () => {
  releaseSlot()
  loaded.value = false
  failed.value = false
  usingFallback.value = false
  shouldLoad.value = false
  stopObserver()
  void nextTick(startObserver)
})

onBeforeUnmount(() => {
  destroyed = true
  stopObserver()
  releaseSlot()
})
</script>

<template>
  <img
    v-if="activeSrc && !failed"
    ref="root"
    :src="shouldLoad ? activeSrc : undefined"
    :alt="alt"
    class="lazy-image"
    :class="{ 'is-loaded': loaded }"
    :data-loading="(!loaded).toString()"
    loading="lazy"
    decoding="async"
    fetchpriority="low"
    @load="onLoad"
    @error="onError"
  >
  <div v-else class="poster-fallback">
    <slot name="fallback"><AppIcon name="i-lucide-image" /></slot>
  </div>
</template>

<style scoped>
.lazy-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--faint, #1a1c22);
}

.lazy-image[data-loading="true"] {
  animation: lazy-pulse 1.3s ease-in-out infinite;
}

.lazy-image.is-loaded {
  animation: none;
}

@keyframes lazy-pulse {
  0%, 100% { background-color: var(--faint, #1a1c22); }
  50% { background-color: color-mix(in srgb, var(--faint, #1a1c22) 55%, transparent); }
}
</style>
