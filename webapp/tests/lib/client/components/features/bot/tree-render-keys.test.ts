import { describe, it, expect } from 'vitest';
import {
  linkRenderKey,
  nodeRenderKey,
  processTreeWithImportanceFiltering
} from '$comps/features/bot/tree-utils.svelte';
import { createTreeLayout } from '$comps/features/bot/d3-utils.svelte';
import type { LinkStats } from '$comps/features/bot/types';
import type { RelationshipTree, TreeNode } from '$lib/types';
import * as d3 from 'd3';

/**
 * Render keys identify a rendered COPY of an entity, not the entity.
 *
 * The workflow view flattens a DAG into a left tree and a right tree, so an entity
 * reachable by two paths is emitted once per path. Both D3 joins and the position map key
 * off that identity: when two copies share a key the node join merges them and the link
 * dedup discards the second copy's edge, which is how a node comes to be drawn with no
 * line and no metrics. Legacy kept every copy separate with a per-render counter
 * (ui/js/components/elements/tree.jsx); these tests pin the same property on a key that is
 * also stable across re-renders, which the position map and the D3 transitions need.
 *
 * The fixtures run the real pipeline — processTreeWithImportanceFiltering → createTreeLayout
 * — so a change to either the builder or the layout is caught here rather than in a browser.
 */

const NODE_WIDTH = 60;
const HEIGHT = 800;

function node(
  id: string,
  relations: { parents?: RelationshipTree[]; children?: RelationshipTree[] } = {}
): RelationshipTree {
  return {
    id,
    name: id.replace(/^(bot|queue|system):/, ''),
    parents: relations.parents ?? [],
    children: relations.children ?? []
  };
}

/** Both paths out of the focus converge on the same transform bot and its whole source chain. */
function diamondTree(): RelationshipTree {
  const sourceChain = () =>
    node('queue:item-rcs-old-new', {
      parents: [
        node('bot:ddb-item-rcs-load', { parents: [node('system:ddb-rcs-item')] })
      ]
    });

  return node('queue:rcs-satori-attempts', {
    parents: [
      node('bot:item-transform-validate', { parents: [sourceChain()] }),
      node('queue:rcs-validation-results', {
        parents: [node('bot:item-transform-validate', { parents: [sourceChain()] })]
      })
    ]
  });
}

/** Expand every node so the whole fixture renders, as an operator drilling in would. */
function expandAll(tree: RelationshipTree, direction: 'left' | 'right'): Set<string> {
  const suffix = direction === 'left' ? 'parents' : 'children';
  const keys = new Set<string>();
  const walk = (node: RelationshipTree) => {
    keys.add(`${node.id}-${suffix}`);
    for (const next of (direction === 'left' ? node.parents : node.children) ?? []) walk(next);
  };
  walk(tree);
  return keys;
}

function layout(tree: RelationshipTree, direction: 'left' | 'right') {
  const root = processTreeWithImportanceFiltering(
    tree,
    direction,
    expandAll(tree, direction),
    new Map<string, LinkStats>(),
    new Map()
  );
  return createTreeLayout(root, direction, HEIGHT, NODE_WIDTH).treeData;
}

/** The component's dedup, verbatim, so the test measures what the renderer actually joins. */
function dedupe(links: d3.HierarchyPointLink<TreeNode>[]) {
  const kept = new Map<string, d3.HierarchyPointLink<TreeNode>>();
  for (const link of links) {
    const key = linkRenderKey(link);
    if (!kept.has(key)) kept.set(key, link);
  }
  return Array.from(kept.values());
}

describe('node render keys', () => {
  it('gives every copy of a repeated entity its own key', () => {
    const tree = layout(diamondTree(), 'left');
    const copies = tree.descendants().filter((n) => n.data.id === 'bot:item-transform-validate');

    expect(copies.length).toBe(2);
    expect(new Set(copies.map(nodeRenderKey)).size).toBe(2);
  });

  it('separates copies of an entity that sit at the same depth on different branches', () => {
    const tree = layout(
      node('bot:focus', {
        parents: [
          node('bot:first-branch', { parents: [node('queue:shared')] }),
          node('bot:second-branch', { parents: [node('queue:shared')] })
        ]
      }),
      'left'
    );

    const copies = tree.descendants().filter((n) => n.data.id === 'queue:shared');

    expect(copies.length).toBe(2);
    expect(copies.map((n) => n.data.depth)).toEqual([2, 2]);
    expect(new Set(copies.map(nodeRenderKey)).size).toBe(2);
  });

  it('keys the same entity differently in the left and right trees', () => {
    const tree = node('bot:focus', {
      parents: [node('queue:in')],
      children: [node('queue:out')]
    });

    expect(nodeRenderKey(layout(tree, 'left'))).not.toBe(nodeRenderKey(layout(tree, 'right')));
  });
});

describe('link render keys', () => {
  it('keeps both copies of a repeated edge through the dedup', () => {
    const links = layout(diamondTree(), 'left').links();
    const repeated = links.filter(
      (l) =>
        l.source.data.id === 'bot:item-transform-validate' &&
        l.target.data.id === 'queue:item-rcs-old-new'
    );

    expect(repeated.length).toBe(2);
    expect(dedupe(links).length).toBe(links.length);
  });

  it('collapses two links that join the same pair of rendered copies', () => {
    const tree = layout(diamondTree(), 'left');
    const [link] = tree.links();

    expect(dedupe([link, link]).length).toBe(1);
  });

  it('never returns the same key for links into different copies', () => {
    const links = layout(diamondTree(), 'left').links();
    const keys = links.map(linkRenderKey);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
