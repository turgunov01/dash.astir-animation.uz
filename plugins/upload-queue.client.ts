export default defineNuxtPlugin(() => {
  const uploadQueue = useUploadQueueStore()
  void uploadQueue.restorePersistedUploads()
})
