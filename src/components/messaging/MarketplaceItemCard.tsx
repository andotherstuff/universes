import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { ShoppingBag, MapPin, Clock, ExternalLink, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { useToast } from '@/hooks/useToast';
import { encodeNaddrForUrl } from '@/lib/utils';
import type { NostrEvent } from '@/types/nostr';

interface MarketplaceItemData {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  seller: string;
  location?: string;
  category: string;
  condition: 'new' | 'used' | 'refurbished';
  createdAt: number;
  event: NostrEvent;
  communityId: string;
}

interface MarketplaceItemCardProps {
  item: MarketplaceItemData;
  isInDM?: boolean;
  className?: string;
}

export function MarketplaceItemCard({ item, isInDM = true, className }: MarketplaceItemCardProps) {
  const [copiedNpub, setCopiedNpub] = useState(false);
  const { toast } = useToast();

  const author = useAuthor(item.seller);
  const metadata = author.data?.metadata;
  const displayName = metadata?.name || genUserName(item.seller);
  const profileImage = metadata?.picture;

  const timeAgo = new Date(item.createdAt * 1000).toLocaleDateString();

  // Generate npub for display and copying
  const npub = nip19.npubEncode(item.seller);
  const shortNpub = `${npub.slice(0, 8)}...${npub.slice(-4)}`;

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'sats') {
      return `${price.toLocaleString()} sats`;
    }
    if (currency === 'btc') {
      return `₿${price}`;
    }
    return `${price} ${currency.toUpperCase()}`;
  };

  const getCurrencyIcon = (currency: string) => {
    switch (currency.toLowerCase()) {
      case 'btc':
        return <span className="text-lg">₿</span>;
      case 'sats':
        return <span className="text-lg">⚡</span>;
      default:
        return <span className="text-lg">$</span>;
    }
  };

  const handleCopyNpub = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(npub);
      setCopiedNpub(true);
      toast({
        title: "Copied!",
        description: "Seller's npub copied to clipboard",
      });
      setTimeout(() => setCopiedNpub(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy npub to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleViewListing = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Generate naddr for the marketplace item
    const [_kind, _pubkey, _identifier] = item.communityId.split(':');
    const naddr = nip19.naddrEncode({
      kind: 30018, // NIP-15 product event
      pubkey: item.seller,
      identifier: item.id,
      relays: [], // Will use user's preferred relays
    });

    // Open in new tab or navigate based on environment
    const encodedNaddr = encodeNaddrForUrl(naddr);
    if (window.open) {
      window.open(`/space/${encodedNaddr}`, '_blank');
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${window.location.origin}/space/${encodedNaddr}`);
      toast({
        title: "Link Copied!",
        description: "Marketplace listing link copied to clipboard",
      });
    }
  };

  return (
    <Card className={`bg-gray-800 border-gray-700 ${isInDM ? 'hover:bg-gray-750' : ''} transition-colors ${className}`}>
      <CardHeader className="p-0">
        <div className="aspect-video bg-gray-700 rounded-t-lg flex items-center justify-center">
          {item.images.length > 0 ? (
            <img
              src={item.images[0]}
              alt={item.name}
              className="w-full h-full object-cover rounded-t-lg"
            />
          ) : (
            <ShoppingBag className="w-12 h-12 text-gray-500" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Title and Price */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-100 truncate">{item.name}</h3>
            <p className="text-gray-400 text-sm line-clamp-2 mt-1">
              {item.description}
            </p>
          </div>
          <div className="flex flex-col items-end ml-3 flex-shrink-0">
            <div className="flex items-center space-x-1 font-bold text-green-400">
              {getCurrencyIcon(item.currency)}
              <span className="text-lg">{formatPrice(item.price, item.currency)}</span>
            </div>
            <Badge variant="secondary" className="mt-1 bg-gray-700 text-gray-200 text-xs">
              {item.condition}
            </Badge>
          </div>
        </div>

        {/* Category and Time */}
        <div className="flex items-center justify-between text-sm">
          <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">
            {item.category}
          </Badge>
          <div className="flex items-center space-x-1 text-gray-400 text-xs">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Location */}
        {item.location && (
          <div className="flex items-center space-x-1 text-sm text-gray-400">
            <MapPin className="w-3 h-3" />
            <span className="text-xs">{item.location}</span>
          </div>
        )}

        {/* Seller Info */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-700">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="bg-indigo-600 text-white text-xs">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-gray-300 text-sm truncate">Sold by {displayName}</span>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500 truncate">{shortNpub}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-gray-600 flex-shrink-0"
                  onClick={handleCopyNpub}
                >
                  {copiedNpub ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {isInDM && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs border-gray-600 hover:bg-gray-600 flex-shrink-0 ml-2"
              onClick={handleViewListing}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Button>
          )}
        </div>

        {/* Marketplace Badge */}
        <div className="flex items-center justify-center pt-2">
          <Badge variant="secondary" className="bg-blue-600/20 text-blue-300 border-blue-600/30 text-xs">
            <ShoppingBag className="w-3 h-3 mr-1" />
            Marketplace Item
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}