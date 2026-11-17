import React, { useId, useMemo } from 'react';
import { resolveAvatarLook } from '../data/avatarLooks';

interface AvatarDollProps {
  avatarId?: string | null;
  name?: string | null;
  color?: string | null;
  size?: number;
  variant?: 'full' | 'bust';
  stumbling?: boolean;
  hideHeadwear?: boolean;
  className?: string;
}

export const AvatarDoll: React.FC<AvatarDollProps> = ({
  avatarId,
  name,
  color,
  size = 48,
  variant = 'full',
  stumbling = false,
  hideHeadwear = false,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const look = useMemo(
    () => resolveAvatarLook(avatarId, name, color),
    [avatarId, name, color]
  );

  const viewBox = variant === 'bust' ? '8 0 48 50' : '0 0 64 78';
  const height = variant === 'bust' ? size : Math.round(size * 1.22);

  const jacketBase = stumbling ? '#991b1b' : look.jacket;
  const skinGradId = `skin-${uid}`;
  const jacketGradId = `jacket-${uid}`;
  const pantsGradId = `pants-${uid}`;
  const capeGradId = `cape-${uid}`;
  const crownGradId = `crown-${uid}`;
  const visorGradId = `visor-${uid}`;
  const auraGradId = `aura-${uid}`;

  const hairConcealedByHat =
    !hideHeadwear &&
    (look.headwear === 'stealth-hood' ||
      look.headwear === 'bucket-hat' ||
      look.headwear === 'samakaka-wrap' ||
      look.headwear === 'driver-cap');

  return (
    <svg
      width={size}
      height={height}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 select-none ${className}`}
      aria-label={name || avatarId || 'Corredor'}
    >
      <defs>
        <radialGradient id={skinGradId} cx="36%" cy="28%" r="74%">
          <stop offset="0%" stopColor={look.skin} stopOpacity="1" />
          <stop offset="65%" stopColor={look.skin} stopOpacity="1" />
          <stop offset="100%" stopColor={look.skinShadow} stopOpacity="1" />
        </radialGradient>

        <linearGradient id={jacketGradId} x1="16" y1="28" x2="48" y2="57" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={jacketBase} />
          <stop offset="52%" stopColor={jacketBase} />
          <stop offset="100%" stopColor="#090a0f" stopOpacity="0.94" />
        </linearGradient>

        <linearGradient id={pantsGradId} x1="22" y1="51" x2="42" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={look.pants} />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>

        <linearGradient id={capeGradId} x1="32" y1="30" x2="32" y2="61" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={look.capeOrScarf || look.jacketAccent} />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        <linearGradient id={crownGradId} x1="21" y1="1" x2="43" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="48%" stopColor={look.headwearColor} />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        <linearGradient id={visorGradId} x1="23" y1="15" x2="41" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.92" />
          <stop offset="45%" stopColor={look.headwearColor} stopOpacity="0.96" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.96" />
        </linearGradient>

        <radialGradient id={auraGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={look.jacketAccent} stopOpacity="0.34" />
          <stop offset="100%" stopColor={look.jacketAccent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Subtle Ambient Rim Aura Behind Silhouette */}
      {variant === 'full' && (
        <ellipse cx="32" cy="40" rx="24" ry="28" fill={`url(#${auraGradId})`} />
      )}

      {/* Volumetric Stage Floor Shadow */}
      {variant === 'full' && (
        <>
          <ellipse cx="32" cy="73.6" rx="16.5" ry="3.9" fill="rgba(0,0,0,0.56)" />
          <ellipse cx="32" cy="73" rx="11.5" ry="2.2" fill={look.jacketAccent} opacity="0.28" />
        </>
      )}

      {/* Flowing Royal Cape or Scarf behind torso */}
      {look.capeOrScarf && (
        <g>
          <path
            d="M 18.5 31 C 13.5 40.5, 10.5 50.5, 9.5 60.5 Q 21 57.2, 32 61.2 Q 43 57.2, 54.5 60.5 C 53.5 50.5, 50.5 40.5, 45.5 31 Z"
            fill={`url(#${capeGradId})`}
            stroke={look.jacketAccent}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path
            d="M 22 33 L 16.8 57.5 M 42 33 L 47.2 57.5 M 32 35 L 32 58.5"
            stroke="#ffffff"
            strokeOpacity="0.16"
            strokeWidth="0.95"
            strokeLinecap="round"
          />
        </g>
      )}

      {/* Sculpted Ponytail / Braids Behind Head */}
      {(look.isFeminine || look.hairStyle === 'ponytail') && look.headwear !== 'samakaka-wrap' && (
        <path
          d="M 41 14 C 50 15, 51.5 25, 46 30.5 C 43 26.5, 42 21, 39.8 18 Z"
          fill={look.hair}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.6"
        />
      )}

      {look.hairStyle === 'afro' && !hairConcealedByHat && (
        <circle cx="32" cy="14.2" r="12.4" fill={look.hair} stroke="rgba(255,255,255,0.1)" strokeWidth="0.7" />
      )}

      {/* Articulated Athletic Legs & Two-Tone Sneakers (full variant) */}
      {variant === 'full' && (
        <g>
          {/* Left Leg + Thigh highlight + Knee crease */}
          <rect
            x="22.4"
            y="51"
            width="7.8"
            height="15.5"
            rx="3.6"
            fill={`url(#${pantsGradId})`}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.65"
          />
          <line x1="25" y1="52.5" x2="25" y2="57" stroke={look.jacketAccent} strokeOpacity="0.26" strokeWidth="1" strokeLinecap="round" />
          <path d="M 24 58.5 L 28.6 58.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" strokeLinecap="round" />

          {/* Right Leg + Thigh highlight + Knee crease */}
          <rect
            x="33.8"
            y="51"
            width="7.8"
            height="15.5"
            rx="3.6"
            fill={`url(#${pantsGradId})`}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.65"
          />
          <line x1="39" y1="52.5" x2="39" y2="57" stroke={look.jacketAccent} strokeOpacity="0.26" strokeWidth="1" strokeLinecap="round" />
          <path d="M 35.4 58.5 L 40 58.5" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" strokeLinecap="round" />

          {/* Left Sneaker with Tongue, Heel & White Midsole */}
          <path
            d="M 19.8 66.8 C 19.8 64.1, 22.8 63.4, 26.5 63.4 C 29.9 63.4, 31.1 65, 31.1 67.2 L 31.1 69.2 L 19.8 69.2 Z"
            fill={look.shoes}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="0.7"
          />
          <path d="M 28.5 64 L 30.8 66.2" stroke={look.jacketAccent} strokeWidth="1.2" strokeLinecap="round" />
          <rect x="19.6" y="68" width="11.6" height="2.1" rx="1" fill="#f8fafc" />
          <path d="M 24.4 64.6 L 27.6 65.5" stroke="#ffffff" strokeWidth="0.95" strokeLinecap="round" opacity="0.85" />

          {/* Right Sneaker with Tongue, Heel & White Midsole */}
          <path
            d="M 32.9 67.2 C 32.9 65, 34.1 63.4, 37.5 63.4 C 41.2 63.4, 44.2 64.1, 44.2 66.8 L 44.2 69.2 L 32.9 69.2 Z"
            fill={look.shoes}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="0.7"
          />
          <path d="M 35.5 64 L 33.2 66.2" stroke={look.jacketAccent} strokeWidth="1.2" strokeLinecap="round" />
          <rect x="32.8" y="68" width="11.6" height="2.1" rx="1" fill="#f8fafc" />
          <path d="M 36.4 65.5 L 39.6 64.6" stroke="#ffffff" strokeWidth="0.95" strokeLinecap="round" opacity="0.85" />
        </g>
      )}

      {/* Athletic Arms with Elbow Seam, Jacket Cuffs & Shaded Hands */}
      <g>
        <g transform="rotate(11 17 33)">
          <rect
            x="12.4"
            y="32.2"
            width="6.9"
            height="16.8"
            rx="3.4"
            fill={`url(#${jacketGradId})`}
            stroke={look.jacketAccent}
            strokeWidth="0.95"
          />
          <path d="M 13.5 40.5 L 18.2 40.5" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
          <rect x="12.7" y="45.6" width="6.3" height="2.3" rx="1" fill={look.jacketAccent} opacity="0.9" />
          <circle cx="15.8" cy="50.1" r="3" fill={`url(#${skinGradId})`} stroke={look.skinShadow} strokeWidth="0.65" />
        </g>

        <g transform="rotate(-11 47 33)">
          <rect
            x="44.7"
            y="32.2"
            width="6.9"
            height="16.8"
            rx="3.4"
            fill={`url(#${jacketGradId})`}
            stroke={look.jacketAccent}
            strokeWidth="0.95"
          />
          <path d="M 45.8 40.5 L 50.5 40.5" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
          <rect x="45" y="45.6" width="6.3" height="2.3" rx="1" fill={look.jacketAccent} opacity="0.9" />
          <circle cx="48.2" cy="50.1" r="3" fill={`url(#${skinGradId})`} stroke={look.skinShadow} strokeWidth="0.65" />
        </g>
      </g>

      {/* Sculpted Sportswear / Royal Jacket Torso */}
      <g>
        <path
          d="M 20.3 30.4 Q 32 28.4 43.7 30.4 Q 46.2 31 45.9 35.2 L 44.5 51.6 Q 44.2 54.6 41 54.6 L 23 54.6 Q 19.8 54.6 19.5 51.6 L 18.1 35.2 Q 17.8 31 20.3 30.4 Z"
          fill={`url(#${jacketGradId})`}
          stroke={look.jacketAccent}
          strokeWidth="1.5"
        />

        {/* Shoulder Specular Highlight */}
        <path
          d="M 21 32 Q 32 30.1 43 32"
          stroke="rgba(255,255,255,0.34)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />

        {/* Inner Collar & V-Neck Under-shirt */}
        <path d="M 25.8 29.8 L 32 40.8 L 38.2 29.8 Z" fill={look.shirt} />
        <path d="M 25 29.8 L 30.2 39 L 28.1 40 L 22.8 31.2 Z" fill={look.jacketAccent} opacity="0.95" />
        <path d="M 39 29.8 L 33.8 39 L 35.9 40 L 41.2 31.2 Z" fill={look.jacketAccent} opacity="0.95" />

        {/* Pattern Details Specific to Character Identity */}
        {look.pattern === 'royal-cape' || look.pattern === 'imperial-armor' ? (
          <>
            <line x1="32" y1="40.8" x2="32" y2="54" stroke="#facc15" strokeWidth="1.2" opacity="0.88" />
            <circle cx="32" cy="43.2" r="1.45" fill="#fef08a" stroke="#92400e" strokeWidth="0.55" />
            <circle cx="32" cy="48.5" r="1.45" fill="#fef08a" stroke="#92400e" strokeWidth="0.55" />
            <path d="M 18.6 33.6 L 24 30.4 L 24 36.6 Z" fill={look.jacketAccent} />
            <path d="M 45.4 33.6 L 40 30.4 L 40 36.6 Z" fill={look.jacketAccent} />
          </>
        ) : look.pattern === 'angola-sash' ? (
          <>
            <path d="M 20.5 31.5 L 43.5 52.5 L 39.5 54.2 L 19 35 Z" fill="#dc2626" />
            <circle cx="32" cy="43" r="2.8" fill="#facc15" stroke="#78350f" strokeWidth="0.65" />
          </>
        ) : look.pattern === 'candonga-vest' ? (
          <>
            <rect x="19.5" y="40" width="25" height="3.2" fill="#f8fafc" />
            <rect x="19.7" y="44.5" width="24.6" height="2.2" fill="#10b981" />
          </>
        ) : look.pattern === 'samakaka-tunic' ? (
          <>
            <path d="M 20 41 L 26 45 L 32 41 L 38 45 L 44 41" stroke="#facc15" strokeWidth="2" strokeLinejoin="round" />
            <rect x="19.5" y="47" width="25" height="3.2" fill="#facc15" />
          </>
        ) : look.pattern === 'racing-chevron' || look.pattern === 'track-stripes' ? (
          <>
            <path d="M 22.5 42.5 L 32 37.4 L 41.5 42.5" stroke={look.jacketAccent} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 22.5 48.5 L 32 43.4 L 41.5 48.5" stroke={look.jacketAccent} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : look.pattern === 'martial-gi' ? (
          <>
            <path d="M 24 30.5 L 38 54" stroke={look.jacketAccent} strokeWidth="2.4" strokeLinecap="round" />
            <rect x="19.5" y="47" width="25" height="3" rx="1" fill="#facc15" />
          </>
        ) : (
          <>
            <line x1="23.5" y1="31" x2="23.5" y2="53.5" stroke={look.jacketAccent} strokeWidth="1.5" opacity="0.88" />
            <line x1="40.5" y1="31" x2="40.5" y2="53.5" stroke={look.jacketAccent} strokeWidth="1.5" opacity="0.88" />
            <rect x="28" y="43.5" width="8" height="3.2" rx="1.4" fill={look.jacketAccent} />
          </>
        )}

        {/* Hem Waistband & Buckle */}
        <rect x="19.6" y="51.6" width="24.8" height="2.8" rx="1.2" fill="rgba(0,0,0,0.42)" />
        <rect x="29.4" y="51.8" width="5.2" height="2.4" rx="0.8" fill={look.jacketAccent} opacity="0.85" />
      </g>

      {/* Neck with Collar Shadow */}
      <rect x="28.8" y="25" width="6.4" height="6.2" rx="2.2" fill={look.skinShadow} />

      {/* Ears for Balanced Proportions */}
      <circle cx="21.3" cy="19" r="2.25" fill={look.skinShadow} />
      <circle cx="42.7" cy="19" r="2.25" fill={look.skinShadow} />
      <circle cx="21.5" cy="19" r="1.1" fill={look.skin} opacity="0.5" />
      <circle cx="42.5" cy="19" r="1.1" fill={look.skin} opacity="0.5" />

      {/* Sculpted Volumetric Head */}
      <path
        d="M 21.4 17.5 C 21.4 10.4, 42.6 10.4, 42.6 17.5 C 42.6 24.9, 37.8 29.3, 32 29.3 C 26.2 29.3, 21.4 24.9, 21.4 17.5 Z"
        fill={`url(#${skinGradId})`}
        stroke={look.skinShadow}
        strokeWidth="0.95"
      />

      {/* Subtle Cheek Specular & Jaw Shading */}
      <ellipse cx="26.5" cy="21.4" rx="2.2" ry="1.1" fill="#ffffff" opacity="0.09" />
      <ellipse cx="37.5" cy="21.4" rx="2.2" ry="1.1" fill="#ffffff" opacity="0.09" />

      {/* Hairline / Tailored Character Hairstyle */}
      {!hairConcealedByHat && (
        <g>
          <path
            d="M 21.5 16.4 C 21.5 8.8, 42.5 8.8, 42.5 16.4 C 39.2 12.4, 24.8 12.4, 21.5 16.4 Z"
            fill={look.hair}
          />
          {look.hairStyle === 'locs' && (
            <>
              <rect x="20.4" y="13.5" width="2.4" height="8" rx="1.2" fill={look.hair} />
              <rect x="41.2" y="13.5" width="2.4" height="8" rx="1.2" fill={look.hair} />
              <rect x="22.8" y="11" width="2.2" height="5.5" rx="1.1" fill={look.hair} />
              <rect x="39" y="11" width="2.2" height="5.5" rx="1.1" fill={look.hair} />
            </>
          )}
          {look.hairStyle === 'braids' && (
            <>
              <path d="M 22 13.5 Q 32 9.5 42 13.5" stroke={look.jacketAccent} strokeWidth="0.9" strokeDasharray="2 1.8" />
              <rect x="20.5" y="15" width="2.1" height="7" rx="1" fill={look.hair} />
              <rect x="41.4" y="15" width="2.1" height="7" rx="1" fill={look.hair} />
            </>
          )}
        </g>
      )}

      {/* Expressive Eyebrows, Detailed Eyes & Confident Expression */}
      <path d="M 25.3 16 Q 28 14.9 30.3 16" stroke={look.hair} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M 33.7 16 Q 36 14.9 38.7 16" stroke={look.hair} strokeWidth="1.3" strokeLinecap="round" />

      {/* Sclera, Iris & Glossy Glint */}
      <ellipse cx="27.9" cy="18.6" rx="2.15" ry="1.7" fill="#f8fafc" />
      <ellipse cx="36.1" cy="18.6" rx="2.15" ry="1.7" fill="#f8fafc" />
      <circle cx="28" cy="18.6" r="1.28" fill="#09090b" />
      <circle cx="36" cy="18.6" r="1.28" fill="#09090b" />
      <circle cx="28.48" cy="18.08" r="0.48" fill="#ffffff" />
      <circle cx="36.48" cy="18.08" r="0.48" fill="#ffffff" />

      {/* Subtle Nose Bridge & Confident Smile */}
      <path d="M 31.6 19.6 L 31.2 21.4 L 32.6 21.6" stroke={look.skinShadow} strokeWidth="0.95" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M 28.4 23.7 Q 32 26.2 35.6 23.7"
        stroke="#fef3c7"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Character-Identifying Headwear / Gear */}
      {!hideHeadwear && (
        <>
          {look.headwear === 'royal-crown' && (
            <g>
              <path
                d="M 21.6 11.4 L 23.4 3.2 L 28 7.8 L 32 1.4 L 36 7.8 L 40.6 3.2 L 42.4 11.4 Z"
                fill={`url(#${crownGradId})`}
                stroke="#92400e"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <rect x="21.8" y="10" width="20.4" height="2.4" rx="1" fill="#b45309" />
              <circle cx="32" cy="7.4" r="1.7" fill={look.headwearAccent} stroke="#fef08a" strokeWidth="0.4" />
              <circle cx="26" cy="8.8" r="0.95" fill="#fef08a" />
              <circle cx="38" cy="8.8" r="0.95" fill="#fef08a" />
              <circle cx="32" cy="1.6" r="1" fill="#fef9c3" />
            </g>
          )}

          {look.headwear === 'imperial-crown' && (
            <g>
              <path
                d="M 20 12.2 L 22 2.2 L 27.5 6.8 L 32 0.8 L 36.5 6.8 L 42 2.2 L 44 12.2 Z"
                fill={`url(#${crownGradId})`}
                stroke="#78350f"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              <rect x="21.5" y="10" width="21" height="2.6" rx="1" fill="#b45309" />
              <polygon points="32,4.3 34.3,7.5 32,9.9 29.7,7.5" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="0.45" />
            </g>
          )}

          {look.headwear === 'headphones-visor' && (
            <g>
              <path d="M 20.4 17.5 C 20.4 5.8, 43.6 5.8, 43.6 17.5" stroke={look.headwearColor} strokeWidth="2.9" strokeLinecap="round" />
              <rect x="18.4" y="13.8" width="4.2" height="7.8" rx="2.1" fill={look.headwearColor} stroke="#09090b" strokeWidth="0.7" />
              <rect x="41.4" y="13.8" width="4.2" height="7.8" rx="2.1" fill={look.headwearColor} stroke="#09090b" strokeWidth="0.7" />
              <rect x="23.4" y="15.8" width="17.2" height="5" rx="2.1" fill={`url(#${visorGradId})`} stroke={look.headwearColor} strokeWidth="1.1" />
              <line x1="25" y1="17.2" x2="31" y2="17.2" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="0.9" strokeLinecap="round" />
            </g>
          )}

          {(look.headwear === 'visor-band' ||
            look.headwear === 'royal-headband' ||
            look.headwear === 'flame-bandana' ||
            look.headwear === 'martial-headband') && (
            <g>
              <rect x="21" y="10.2" width="22" height="4.4" rx="1.7" fill={look.headwearColor} stroke="rgba(0,0,0,0.35)" strokeWidth="0.65" />
              <path d="M 42.2 12 L 48.4 9.6 L 46 14.6 Z" fill={look.headwearAccent} />
              <circle cx="32" cy="12.4" r="1.7" fill={look.headwearAccent} />
            </g>
          )}

          {look.headwear === 'aviator-goggles' && (
            <g>
              <rect x="21.5" y="9.8" width="21" height="3.6" rx="1.2" fill="#334155" />
              <circle cx="27.8" cy="11.8" r="3.2" fill={look.headwearColor} stroke="#f8fafc" strokeWidth="1" />
              <circle cx="36.2" cy="11.8" r="3.2" fill={look.headwearColor} stroke="#f8fafc" strokeWidth="1" />
              <path d="M 26.6 10.6 L 28.6 10.6" stroke="#ffffff" strokeWidth="0.85" strokeLinecap="round" opacity="0.85" />
              <path d="M 35 10.6 L 37 10.6" stroke="#ffffff" strokeWidth="0.85" strokeLinecap="round" opacity="0.85" />
            </g>
          )}

          {look.headwear === 'stealth-hood' && (
            <g>
              <path
                d="M 20.2 19.2 C 20.2 6.8, 43.8 6.8, 43.8 19.2 L 41 13.5 C 35 11.8, 29 11.8, 23 13.5 Z"
                fill={look.headwearColor}
                stroke={look.headwearAccent}
                strokeWidth="1.05"
              />
              <path d="M 22.2 22.8 Q 32 26 41.8 22.8 L 41.2 27.6 L 22.8 27.6 Z" fill={look.headwearColor} />
            </g>
          )}

          {look.headwear === 'crystal-visor' && (
            <g>
              <polygon
                points="23,15.8 41,15.8 39.2,21 34,21 32,19.1 30,21 24.8,21"
                fill={`url(#${visorGradId})`}
                stroke="#ecfeff"
                strokeWidth="1.05"
              />
              <line x1="25.5" y1="17.2" x2="31" y2="17.2" stroke="#ffffff" strokeWidth="0.9" strokeOpacity="0.7" strokeLinecap="round" />
            </g>
          )}

          {look.headwear === 'bucket-hat' && (
            <g>
              <path d="M 21.8 12.2 L 24 5.8 L 40 5.8 L 42.2 12.2 Z" fill={look.headwearColor} />
              <rect x="21.8" y="10.2" width="20.4" height="2" fill={look.headwearAccent} />
              <path d="M 17.5 13 Q 32 10.2 46.5 13 L 44.5 15 Q 32 12.8 19.5 15 Z" fill={look.headwearColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
            </g>
          )}

          {look.headwear === 'shades-band' && (
            <g>
              <path d="M 21.8 12.2 C 23 6.8, 41 6.8, 42.2 12.2 Z" fill={look.headwearColor} />
              <rect x="38" y="10.5" width="7.5" height="2.4" rx="1" fill={look.headwearAccent} />
              <rect x="23.8" y="16.4" width="7.2" height="4.2" rx="1.1" fill="#09090b" stroke={look.headwearColor} strokeWidth="1.05" />
              <rect x="33" y="16.4" width="7.2" height="4.2" rx="1.1" fill="#09090b" stroke={look.headwearColor} strokeWidth="1.05" />
              <line x1="31" y1="18.3" x2="33" y2="18.3" stroke={look.headwearColor} strokeWidth="1.1" />
            </g>
          )}

          {look.headwear === 'samakaka-wrap' && (
            <g>
              <path
                d="M 20.6 14.4 C 20.6 6.2, 43.4 6.2, 43.4 14.4 C 37 11.6, 27 11.6, 20.6 14.4 Z"
                fill={look.headwearColor}
                stroke={look.headwearAccent}
                strokeWidth="1.2"
              />
              <circle cx="32" cy="9" r="3.3" fill={look.headwearAccent} stroke={look.headwearColor} strokeWidth="1" />
            </g>
          )}

          {look.headwear === 'driver-cap' && (
            <g>
              <path d="M 21.2 13.2 C 22 7.2, 42 7.2, 42.8 13.2 Z" fill={look.headwearColor} />
              <rect x="21.6" y="11" width="20.8" height="2.2" fill={look.headwearAccent} />
              <path d="M 20 13.2 L 38.5 13.2 L 45 15.6 L 24 15 Z" fill="#0f172a" />
            </g>
          )}
        </>
      )}
    </svg>
  );
};
