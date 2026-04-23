REFERENCE: https://svelte.dev/docs/svelte/v5-migration-guide


In SvelteKit 5 running the following is deprecated
```
    import { page } from "$app/stores";
    let url = $page.url.pathname;
```

This now should be 
```
  import { page } from '$app/state';
  let url = page.url.pathname;
```

Using `on:click` for components is deprecated 
```
<Button
      variant="outline"
      size="sm"
      on:click={() => table.nextPage()}
      disabled={!table.getCanNextPage()}
    >
```

You should use `onclick`

```
<Button
      variant="outline"
      size="sm"
      onclick={() => table.nextPage()}
      disabled={!table.getCanNextPage()}
    >
```

Using this pattern is deprecated: 
```
let count = $state(0);
$: foo = count * 2;
```

It should use the new `$derived` rune

```
let count = $state(0);
const  foo = $derived(count * 2);
```

creating side effects like this is deprecated: 
```
  let count = $state(0);
  $: {
    if(count > 5) {
      alert('Count is too high!');
    }
  }
```

You should use the `$effect` rune instead

```
let count = $state(0);
$effect(()=>{
    if(count > 5) {
      alert('Count is too high!');
    }
  });
```