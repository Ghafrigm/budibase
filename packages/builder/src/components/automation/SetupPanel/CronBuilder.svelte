<script>
  import { Button, Select, Input, Label } from "@budibase/bbui"
  import { createEventDispatcher } from "svelte"
  const dispatch = createEventDispatcher()

  export let value
  const onChange = e => {
    value = e.detail
    dispatch("change", e.detail)
  }

  let touched = false
  let presets = false

  const CRON_EXPRESSIONS = [
    {
      label: "Every Minute",
      value: "* * * * *",
    },
    {
      label: "Every Hour",
      value: "0 * * * *",
    },
    {
      label: "Every Morning at 8AM",
      value: "0 8 * * *",
    },
    {
      label: "Every Night at Midnight",
      value: "0 0 * * *",
    },
    {
      label: "Every Budibase Reboot",
      value: "@reboot",
    },
  ]
</script>

<div class="block-field">
  <Input on:change={onChange} {value} on:blur={() => (touched = true)} />
  {#if touched && !value}
    <Label><div class="error">Please specify a CRON expression</div></Label>
  {/if}
  <div class="presets">
    <Button on:click={() => (presets = !presets)}
      >{presets ? "Hide" : "Show"} Presets</Button
    >
    {#if presets}
      <Select
        on:change={onChange}
        {value}
        secondary
        extraThin
        label="Presets"
        options={CRON_EXPRESSIONS}
      />
    {/if}
  </div>
</div>

<style>
  .presets {
    margin-top: var(--spacing-m);
  }
  .block-field {
    padding-top: var(--spacing-s);
  }
  .error {
    padding-top: var(--spacing-xs);
    color: var(--spectrum-global-color-red-500);
  }
</style>
