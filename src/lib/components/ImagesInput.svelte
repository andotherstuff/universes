<script lang="ts">
  import {randomId} from "@welshman/lib"
  import {removeAt, insertAt} from "@welshman/lib"
  import {preventDefault, stopPropagation} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  interface Props {
    value: (string | File)[]
    multiple?: boolean
  }

  let {value = $bindable(), multiple = true}: Props = $props()

  const id = randomId()

  const getImageUrl = (item: string | File): string => {
    if (typeof item === "string") return item
    return URL.createObjectURL(item)
  }

  const addFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(file => file.type.startsWith("image/"))
    value = [...value, ...newFiles]
  }

  const removeItem = (index: number) => {
    value = removeAt(index, value)
  }

  const onFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    if (target.files?.length) {
      addFiles(target.files)
      target.value = ""
    }
  }

  const onDrop = (e: Event) => {
    dropActive = false
    const dragEvent = e as DragEvent
    if (dragEvent.dataTransfer?.files?.length) {
      addFiles(dragEvent.dataTransfer.files)
    }
  }

  const onDragEnter = (e: Event) => {
    dropActive = true
  }

  const onDragOver = (e: Event) => {
    dropActive = true
  }

  const onDragLeave = (e: Event) => {
    dropActive = false
  }

  let draggedIndex: number | null = $state(null)
  let dropActive = $state(false)

  const handleDragStart = (e: DragEvent, index: number) => {
    draggedIndex = index

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()

    if (draggedIndex !== null && draggedIndex !== index) {
      value = insertAt(index, value[draggedIndex], removeAt(draggedIndex, value))
      draggedIndex = index
    }
  }

  const handleDragEnd = () => {
    draggedIndex = null
  }
</script>

<div class="flex flex-col gap-2">
  <div class="grid grid-cols-3 gap-3" role="list">
    {#each value as item, index (index)}
      <div
        class="relative aspect-square cursor-move"
        class:border-primary={draggedIndex === index}
        draggable="true"
        role="listitem"
        aria-label="Draggable image"
        ondragstart={e => handleDragStart(e, index)}
        ondragover={e => handleDragOver(e, index)}
        ondragend={handleDragEnd}>
        <img
          src={getImageUrl(item)}
          alt="Upload preview"
          class="h-full w-full object-cover rounded-box" />
        <Button
          class="absolute right-1 top-1 w-5 h-5 flex justify-center items-center rounded-full bg-base-100"
          onclick={() => removeItem(index)}>
          <Icon icon={CloseCircle} size={6} />
        </Button>
      </div>
    {/each}
    <label
      for={id}
      class="flex cursor-pointer aspect-square items-center justify-center rounded-lg border-2 border-dashed border-base-content text-sm"
      class:border-primary={dropActive}
      aria-label="Drag and drop images here or click to select"
      ondragenter={stopPropagation(preventDefault(onDragEnter))}
      ondragover={stopPropagation(preventDefault(onDragOver))}
      ondragleave={stopPropagation(preventDefault(onDragLeave))}
      ondrop={stopPropagation(preventDefault(onDrop))}>
      <div class="flex flex-col items-center gap-2 text-center">
        <Icon icon={GallerySend} size={8} />
        <p class="text-sm opacity-70">Drag and drop images or click to select</p>
      </div>
    </label>
  </div>
  <input {id} type="file" accept="image/*" {multiple} onchange={onFileChange} class="hidden" />
</div>
