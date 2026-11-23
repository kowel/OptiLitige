'use client';
import { useId, useRef, useState, useEffect } from 'react';
import { AtSign, Send } from 'lucide-react';
import {
  findMentionQuery,
  filterMentionMembers,
  reconcileMentionTokens,
  insertMention,
  selectedMentionEmails,
} from './mention-logic.mjs';
import type { Member } from './types';

// Mention repérée dans le texte (position de « @Nom » et agent mentionné)
interface MentionToken {
  start: number;
  end: number;
  email: string;
  label: string;
}
// Saisie en cours après « @ » (position et texte recherché)
interface MentionQuery {
  start: number;
  end: number;
  query: string;
}
export default function CommentComposer({
  members,
  busy,
  onSubmit,
}: {
  members: Member[];
  busy: boolean;
  onSubmit: (text: string, mentions: string[]) => Promise<boolean>;
}) {
  const [text, setText] = useState(''),
    [tokens, setTokens] = useState<MentionToken[]>([]),
    [query, setQuery] = useState<MentionQuery | null>(null),
    [active, setActive] = useState(0),
    [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null),
    wrapper = useRef<HTMLDivElement>(null),
    textRef = useRef(''),
    tokensRef = useRef<MentionToken[]>([]),
    dismissed = useRef(false);
  const listId = useId();
  const matches = query ? filterMentionMembers(members, query.query) : [];
  const emails = selectedMentionEmails(text, tokens, members);
  const selected = members.filter((m) => emails.includes(m.email));
  function updateQuery(value: string, caret: number, marked = tokensRef.current) {
    if (dismissed.current) return;
    setQuery(findMentionQuery(value, caret, marked));
    setActive(0);
  }
  function change(value: string, caret: number) {
    const nextTokens = reconcileMentionTokens(textRef.current, value, tokensRef.current);
    textRef.current = value;
    tokensRef.current = nextTokens;
    setText(value);
    setTokens(nextTokens);
    setError('');
    dismissed.current = false;
    updateQuery(value, caret, nextTokens);
  }
  function choose(member: Member) {
    if (!query || busy) return;
    const next = insertMention(textRef.current, query, member, tokensRef.current);
    textRef.current = next.text;
    tokensRef.current = next.tokens;
    setText(next.text);
    setTokens(next.tokens);
    setQuery(null);
    setActive(0);
    dismissed.current = true;
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(next.caret, next.caret);
      setQuery(null);
    });
  }
  useEffect(() => {
    if (query) document.getElementById(listId + '-' + active)?.scrollIntoView({ block: 'nearest' });
  }, [active, query, listId]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    const targets = selectedMentionEmails(text, tokens, members);
    if (targets.length > 20) {
      setError('Vous pouvez mentionner au maximum 20 agents dans un commentaire.');
      return;
    }
    if (await onSubmit(text, targets)) {
      textRef.current = '';
      tokensRef.current = [];
      setText('');
      setTokens([]);
      setQuery(null);
      setError('');
      dismissed.current = false;
    }
  }
  return (
    <form className="comment-form mention-composer" onSubmit={submit}>
      <div
        className="mention-input-wrap"
        ref={wrapper}
        onBlur={(e) => {
          if (!wrapper.current?.contains(e.relatedTarget as Node)) setQuery(null);
        }}
      >
        <textarea
          ref={input}
          aria-label="Votre commentaire"
          required
          maxLength={5000}
          disabled={busy}
          value={text}
          onChange={(e) => change(e.target.value, e.target.selectionStart)}
          onSelect={(e) => updateQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
          onClick={(e) => {
            dismissed.current = false;
            updateQuery(e.currentTarget.value, e.currentTarget.selectionStart);
          }}
          onKeyDown={(e) => {
            if (!query) return;
            if (e.key === 'Escape') {
              e.preventDefault();
              dismissed.current = true;
              setQuery(null);
              return;
            }
            if (!matches.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive(
                (previous) =>
                  (previous + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length,
              );
            } else if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
              e.preventDefault();
              choose(matches[Math.min(active, matches.length - 1)]);
            }
          }}
          aria-autocomplete="list"
          aria-controls={query ? listId : undefined}
          aria-activedescendant={
            query && matches.length
              ? listId + '-' + Math.min(active, matches.length - 1)
              : undefined
          }
          placeholder="Écrivez votre commentaire… Tapez @ pour mentionner un agent."
        />
        {query && (
          <div className="mention-suggestions">
            <div className="mention-suggestions-title">
              <AtSign size={13} />
              Mentionner un agent
            </div>
            <ul id={listId} role="listbox" aria-label="Agents à mentionner">
              {matches.map((member: Member, i: number) => (
                <li
                  key={member.email}
                  id={listId + '-' + i}
                  role="option"
                  aria-selected={i === active}
                >
                  <button
                    type="button"
                    disabled={busy}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(member)}
                  >
                    <span className="avatar">
                      {member.name
                        .split(' ')
                        .map((s: string) => s[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.role} · {member.email}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!matches.length && (
              <p className="mention-no-match">Aucun agent ne correspond à « {query.query} ».</p>
            )}
            <div className="mention-key-help">
              ↑ ↓ pour choisir · Entrée ou Tab pour sélectionner · Échap pour fermer
            </div>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="selected-mentions" aria-label="Agents qui seront notifiés">
          {selected.map((member) => (
            <span key={member.email}>@{member.name}</span>
          ))}
        </div>
      )}
      <div className="composer-actions">
        <small>
          <AtSign size={12} />
          Tapez @ puis un nom et sélectionnez une suggestion.
        </small>
        <button className="primary" disabled={busy || !text.trim()}>
          <Send size={15} />
          Envoyer
        </button>
      </div>
      <small>Les agents mentionnés seront notifiés une seule fois par dossier.</small>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
