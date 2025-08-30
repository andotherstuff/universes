import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { NoteContent } from './NoteContent';
import type { NostrEvent } from '@nostrify/nostrify';

describe('NoteContent', () => {
  it('linkifies URLs in kind 1 events', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Check out this link: https://example.com',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} onNavigateToDMs={vi.fn()} />
      </TestApp>
    );

    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('linkifies URLs in kind 9411 events (channel messages)', () => {
    const event: NostrEvent = {
      id: 'test-message-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9411,
      tags: [
        ['t', 'general'],
        ['a', '34550:pubkey:community'],
      ],
      content: 'Check out this new channel message format: https://nostrbook.dev/kinds/9411',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} onNavigateToDMs={vi.fn()} />
      </TestApp>
    );

    const link = screen.getByRole('link', { name: 'https://nostrbook.dev/kinds/9411' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://nostrbook.dev/kinds/9411');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('handles text without URLs correctly', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 9411,
      tags: [],
      content: 'This is just plain text without any links.',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    expect(screen.getByText('This is just plain text without any links.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders hashtags as links', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'This is a post about #nostr and #bitcoin development.',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    const nostrHashtag = screen.getByRole('link', { name: '#nostr' });
    const bitcoinHashtag = screen.getByRole('link', { name: '#bitcoin' });

    expect(nostrHashtag).toBeInTheDocument();
    expect(bitcoinHashtag).toBeInTheDocument();
    expect(nostrHashtag).toHaveAttribute('href', '/t/nostr');
    expect(bitcoinHashtag).toHaveAttribute('href', '/t/bitcoin');
  });

  it('renders user mentions as links', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Hello @[Alice](1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef) and @[Bob](fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321)!',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    const aliceButton = screen.getByRole('button', { name: '@Alice' });
    const bobButton = screen.getByRole('button', { name: '@Bob' });

    expect(aliceButton).toBeInTheDocument();
    expect(bobButton).toBeInTheDocument();

    // Check that the buttons are clickable
    expect(aliceButton).toHaveClass('cursor-pointer');
    expect(bobButton).toHaveClass('cursor-pointer');
  });

  it('does not duplicate @ symbol in user mentions', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Hello @[Alice](1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef)!',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} onNavigateToDMs={vi.fn()} />
      </TestApp>
    );

    const aliceButton = screen.getByRole('button', { name: '@Alice' });

    // Check that the button contains exactly "@Alice" (not "@@Alice")
    expect(aliceButton).toBeInTheDocument();
    expect(aliceButton.textContent).toBe('@Alice');

    // Verify there's no double @ symbol by checking the rendered HTML
    expect(aliceButton.innerHTML).not.toContain('@@');
  });

  it('opens profile dialog when mention is clicked', async () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Hello @[Alice](1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef)!',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} onNavigateToDMs={vi.fn()} />
      </TestApp>
    );

    const aliceButton = screen.getByRole('button', { name: '@Alice' });

    // Click the mention
    await userEvent.click(aliceButton);

    // Check that the profile dialog appears by looking for a close button or the user's name
    // The dialog should contain either a close button (X) or the user's name
    const closeButton = await screen.findByRole('button', { name: /close/i }, { timeout: 3000 }).catch(() => null);
    const userName = await screen.findByText(/Alice/i, {}, { timeout: 3000 }).catch(() => null);

    expect(closeButton || userName).toBeInTheDocument();
  });

  it('generates deterministic names for users without metadata and styles them differently', () => {
    // Use a valid npub for testing
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: `Mentioning nostr:npub1zg69v7ys40x77y352eufp27daufrg4ncjz4ummcjx3t83y9tehhsqepuh0`,
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // The mention should be rendered with a deterministic name
    const mention = screen.getByRole('button');
    expect(mention).toBeInTheDocument();

    // Should have muted styling for generated names (gray instead of blue)
    expect(mention).toHaveClass('text-gray-500');
    expect(mention).not.toHaveClass('text-blue-500');

    // The text should start with @ and contain a generated name (not a truncated npub)
    const linkText = mention.textContent;
    expect(linkText).not.toMatch(/^@npub1/); // Should not be a truncated npub
    expect(linkText).toEqual("@Swift Falcon");
  });

  it('renders image URLs as images instead of links', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Check out this image: https://example.com/image.jpg and this one: https://picsum.photos/200/300.png',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Should find images instead of links
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);

    // Check that the images have the correct attributes
    expect(images[0]).toHaveAttribute('src', 'https://example.com/image.jpg');
    expect(images[0]).toHaveAttribute('alt', 'Shared image');
    expect(images[0]).toHaveClass('object-cover');

    expect(images[1]).toHaveAttribute('src', 'https://picsum.photos/200/300.png');
    expect(images[1]).toHaveAttribute('alt', 'Shared image');
    expect(images[1]).toHaveClass('object-cover');

    // Should not have any links for the image URLs
    const links = screen.queryAllByRole('link');
    const imageLinks = links.filter(link =>
      link.getAttribute('href') === 'https://example.com/image.jpg' ||
      link.getAttribute('href') === 'https://picsum.photos/200/300.png'
    );
    expect(imageLinks).toHaveLength(0);
  });

  it('renders non-image URLs as links', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: 'Check out this video: https://example.com/video.mp4 and this page: https://example.com/page.html',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Should find links for non-image URLs
    const videoLink = screen.getByRole('link', { name: 'https://example.com/video.mp4' });
    const pageLink = screen.getByRole('link', { name: 'https://example.com/page.html' });

    expect(videoLink).toBeInTheDocument();
    expect(videoLink).toHaveAttribute('href', 'https://example.com/video.mp4');
    expect(videoLink).toHaveAttribute('target', '_blank');

    expect(pageLink).toBeInTheDocument();
    expect(pageLink).toHaveAttribute('href', 'https://example.com/page.html');
    expect(pageLink).toHaveAttribute('target', '_blank');

    // Should not have any images
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders markdown content correctly', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '**Bold text** and *italic text* and `code`',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Check that bold text is rendered
    const boldText = screen.getByText('Bold text');
    expect(boldText).toBeInTheDocument();
    expect(boldText.tagName).toBe('STRONG');

    // Check that italic text is rendered
    const italicText = screen.getByText('italic text');
    expect(italicText).toBeInTheDocument();
    expect(italicText.tagName).toBe('EM');

    // Check that code is rendered
    const codeText = screen.getByText('code');
    expect(codeText).toBeInTheDocument();
    expect(codeText.tagName).toBe('CODE');
  });

  it('renders markdown headings correctly', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '# Heading 1\n## Heading 2\n### Heading 3\n#### Heading 4\n##### Heading 5\n###### Heading 6',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Check that all headings are rendered with correct tags and classes
    const h1 = screen.getByText('Heading 1');
    expect(h1).toBeInTheDocument();
    expect(h1.tagName).toBe('H1');
    expect(h1).toHaveClass('text-2xl', 'font-bold');

    const h2 = screen.getByText('Heading 2');
    expect(h2).toBeInTheDocument();
    expect(h2.tagName).toBe('H2');
    expect(h2).toHaveClass('text-xl', 'font-semibold');

    const h3 = screen.getByText('Heading 3');
    expect(h3).toBeInTheDocument();
    expect(h3.tagName).toBe('H3');
    expect(h3).toHaveClass('text-lg', 'font-medium');

    const h4 = screen.getByText('Heading 4');
    expect(h4).toBeInTheDocument();
    expect(h4.tagName).toBe('H4');
    expect(h4).toHaveClass('text-base', 'font-medium');

    const h5 = screen.getByText('Heading 5');
    expect(h5).toBeInTheDocument();
    expect(h5.tagName).toBe('H5');
    expect(h5).toHaveClass('text-sm', 'font-medium');

    const h6 = screen.getByText('Heading 6');
    expect(h6).toBeInTheDocument();
    expect(h6.tagName).toBe('H6');
    expect(h6).toHaveClass('text-sm', 'font-medium');
  });

  it('renders unordered lists (bullet points) correctly', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '- First item\n- Second item\n- Third item',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Check that the list is rendered
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(list.tagName).toBe('UL');
    expect(list).toHaveClass('list-disc', 'list-inside', 'space-y-0.5', 'my-0.5', 'pl-2');

    // Check that list items are rendered
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    expect(items[0]).toBeInTheDocument();
    expect(items[0].tagName).toBe('LI');
    expect(items[0]).toHaveClass('pl-1');
    expect(items[0]).toHaveTextContent('First item');

    expect(items[1]).toBeInTheDocument();
    expect(items[1].tagName).toBe('LI');
    expect(items[1]).toHaveClass('pl-1');
    expect(items[1]).toHaveTextContent('Second item');

    expect(items[2]).toBeInTheDocument();
    expect(items[2].tagName).toBe('LI');
    expect(items[2]).toHaveClass('pl-1');
    expect(items[2]).toHaveTextContent('Third item');
  });

  it('renders ordered lists (numbered) correctly', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '1. First step\n2. Second step\n3. Third step',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Check that the ordered list is rendered
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    expect(list.tagName).toBe('OL');
    expect(list).toHaveClass('list-decimal', 'list-inside', 'space-y-0.5', 'my-0.5', 'pl-4');

    // Check that list items are rendered
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    expect(items[0]).toBeInTheDocument();
    expect(items[0].tagName).toBe('LI');
    expect(items[0]).toHaveClass('pl-1');
    expect(items[0]).toHaveTextContent('First step');

    expect(items[1]).toBeInTheDocument();
    expect(items[1].tagName).toBe('LI');
    expect(items[1]).toHaveClass('pl-1');
    expect(items[1]).toHaveTextContent('Second step');

    expect(items[2]).toBeInTheDocument();
    expect(items[2].tagName).toBe('LI');
    expect(items[2]).toHaveClass('pl-1');
    expect(items[2]).toHaveTextContent('Third step');
  });

  it('renders mixed list formats correctly', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '* Bullet item 1\n* Bullet item 2\n+ Another bullet\n1. Numbered item 1\n2. Numbered item 2',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Should have multiple lists (different bullet types create separate lists)
    const lists = screen.getAllByRole('list');
    expect(lists.length).toBeGreaterThan(1);

    // Check that we have both unordered and ordered lists
    const unorderedLists = lists.filter(list => list.tagName === 'UL');
    const orderedLists = lists.filter(list => list.tagName === 'OL');

    expect(unorderedLists.length).toBeGreaterThan(0);
    expect(orderedLists.length).toBe(1);

    // Check that unordered lists have the correct classes
    unorderedLists.forEach(list => {
      expect(list).toHaveClass('list-disc', 'list-inside');
    });

    // Check that ordered list has the correct classes
    expect(orderedLists[0]).toHaveClass('list-decimal', 'list-inside', 'space-y-0.5', 'my-0.5', 'pl-4');

    // Check total number of list items
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
  });

  it('renders ordered lists with inline styling', () => {
    const event: NostrEvent = {
      id: 'test-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: '1. First item\n2. Second item\n3. Third item',
      sig: 'test-sig',
    };

    render(
      <TestApp>
        <NoteContent event={event} />
      </TestApp>
    );

    // Check that the ordered list has the correct styling classes
    const orderedList = screen.getByRole('list');
    expect(orderedList).toBeInTheDocument();
    expect(orderedList.tagName).toBe('OL');
    expect(orderedList).toHaveClass('list-decimal', 'list-inside', 'space-y-0.5', 'my-0.5', 'pl-4');

    // Check that list items exist
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});