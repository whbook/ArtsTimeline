import React from 'react';

const decodeHtmlEntities = (value: string) => {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
};

const getPlainTextParagraphs = (value: string) => {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\s+(?=【[^】]+】)/g, '\n\n')
    .trim();

  const explicitParagraphs = normalized.split(/\n\s*\n/).filter(Boolean);
  if (explicitParagraphs.length > 1) return explicitParagraphs;

  const containsCjk = /[\u4e00-\u9fff]/.test(normalized);
  if (!containsCjk) return [normalized];

  return normalized
    .split(/(?<=[。！？])\s+(?=[【《（(一-龥])/u)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);
};

interface DescriptionTextProps {
  value: string;
  className?: string;
}

const DescriptionText: React.FC<DescriptionTextProps> = ({ value, className = '' }) => {
  const html = value.includes('&lt;') && value.includes('&gt;') ? decodeHtmlEntities(value) : value;
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(html);
  const baseClassName =
    'text-sm leading-relaxed text-stone-600 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_br]:block [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-bold [&_b]:font-bold';
  const resolvedClassName = `${baseClassName} ${className}`.trim();

  if (hasHtml) {
    return <div className={resolvedClassName} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className={resolvedClassName}>
      {getPlainTextParagraphs(value).map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 12)}`} className="mb-3 last:mb-0 whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
};

export default DescriptionText;
