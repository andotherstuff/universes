import { useState, useEffect, useMemo } from 'react';
import { Shield, Users, Hash, Settings, Check, Copy, QrCode, CheckCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { generateCommunityIdentifier } from '@/lib/utils';
import { nip19 } from 'nostr-tools';
import QRCode from 'qrcode';

interface QuickSetupStepProps {
  onCreateCommunity: () => void;
  onPrevious: () => void;
  formData: {
    name: string;
    description: string;
    image: string;
  };
  userPubkey: string;
}

export function QuickSetupStep({
  onCreateCommunity,
  onPrevious,
  formData,
  userPubkey
}: QuickSetupStepProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [moderatorQrCodeDataUrl, setModeratorQrCodeDataUrl] = useState<string>('');
  const [memberQrCodeDataUrl, setMemberQrCodeDataUrl] = useState<string>('');
  const [isGeneratingModeratorQR, setIsGeneratingModeratorQR] = useState(false);
  const [isGeneratingMemberQR, setIsGeneratingMemberQR] = useState(false);
  const { toast } = useToast();


  // Generate preview sharing links (memoized to prevent infinite re-renders)
  const { moderatorJoinUrl, memberJoinUrl } = useMemo(() => {
    if (!formData.name.trim() || !userPubkey) return { moderatorJoinUrl: '', memberJoinUrl: '' };

    try {
      const communityIdentifier = generateCommunityIdentifier(formData.name);
      
      // Generate naddr
      const naddr = nip19.naddrEncode({
        kind: 34550,
        pubkey: userPubkey,
        identifier: communityIdentifier,
      });

      // Generate URLs with role-specific parameters
      const baseUrl = window.location.origin;
      const moderatorJoinUrl = `${baseUrl}/join/${encodeURIComponent(naddr)}?role=moderator`;
      const memberJoinUrl = `${baseUrl}/join/${encodeURIComponent(naddr)}?role=member`;

      return { moderatorJoinUrl, memberJoinUrl };
    } catch (error) {
      console.error('Failed to generate preview links:', error);
      return { moderatorJoinUrl: '', memberJoinUrl: '' };
    }
  }, [formData.name, userPubkey]);

  // Generate moderator QR code
  useEffect(() => {
    if (!moderatorJoinUrl) return;

    const generateModeratorQRCode = async () => {
      try {
        setIsGeneratingModeratorQR(true);
        const qrDataUrl = await QRCode.toDataURL(moderatorJoinUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setModeratorQrCodeDataUrl(qrDataUrl);
      } catch (error) {
        console.error('Failed to generate moderator QR code:', error);
        toast({
          title: 'Error',
          description: 'Failed to generate moderator QR code',
          variant: 'destructive',
        });
      } finally {
        setIsGeneratingModeratorQR(false);
      }
    };

    generateModeratorQRCode();
  }, [moderatorJoinUrl, toast]);

  // Generate member QR code
  useEffect(() => {
    if (!memberJoinUrl) return;

    const generateMemberQRCode = async () => {
      try {
        setIsGeneratingMemberQR(true);
        const qrDataUrl = await QRCode.toDataURL(memberJoinUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setMemberQrCodeDataUrl(qrDataUrl);
      } catch (error) {
        console.error('Failed to generate member QR code:', error);
        toast({
          title: 'Error',
          description: 'Failed to generate member QR code',
          variant: 'destructive',
        });
      } finally {
        setIsGeneratingMemberQR(false);
      }
    };

    generateMemberQRCode();
  }, [memberJoinUrl, toast]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: 'Copied to clipboard',
        description: 'The link has been copied to your clipboard.',
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const copyQRCodeAsImage = async (qrCodeDataUrl: string, field: string) => {
    try {
      // Check if clipboard API is available and supports images
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard API not supported');
      }

      // Convert data URL to blob
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      
      // Check if the browser supports ClipboardItem with images
      if (!window.ClipboardItem) {
        throw new Error('ClipboardItem not supported');
      }

      // Create a proper image blob with correct MIME type
      const imageBlob = new Blob([blob], { type: 'image/png' });

      // Copy blob to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': imageBlob
        })
      ]);
      
      setCopiedField(field);
      toast({
        title: 'QR Code Copied!',
        description: 'The QR code has been copied as an image to your clipboard.',
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy QR code:', error);
      
      // Try alternative approach: create a canvas and copy from there
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            
            canvas.toBlob(async (blob) => {
              if (blob) {
                try {
                  await navigator.clipboard.write([
                    new ClipboardItem({
                      'image/png': blob
                    })
                  ]);
                  resolve(true);
                } catch (clipError) {
                  reject(clipError);
                }
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            }, 'image/png');
          };
          img.onerror = reject;
          img.src = qrCodeDataUrl;
        });
        
        setCopiedField(field);
        toast({
          title: 'QR Code Copied!',
          description: 'The QR code has been copied as an image to your clipboard.',
        });
        setTimeout(() => setCopiedField(null), 2000);
      } catch (canvasError) {
        console.error('Canvas approach also failed:', canvasError);
        
        // Final fallback: Copy the data URL as text
        try {
          await navigator.clipboard.writeText(qrCodeDataUrl);
          setCopiedField(field);
          toast({
            title: 'QR Code URL Copied',
            description: 'The QR code URL has been copied to your clipboard. You can paste it into an image editor.',
          });
          setTimeout(() => setCopiedField(null), 2000);
        } catch (fallbackError) {
          console.error('Fallback copy also failed:', fallbackError);
          toast({
            title: 'Copy Failed',
            description: 'Your browser doesn\'t support copying images. Use the Download button instead.',
            variant: 'destructive',
          });
        }
      }
    }
  };

  const downloadQRCode = (qrCodeDataUrl: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = qrCodeDataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'QR Code Downloaded',
        description: 'The QR code has been saved to your downloads folder.',
      });
    } catch (error) {
      console.error('Failed to download QR code:', error);
      toast({
        title: 'Download Failed',
        description: 'Could not download the QR code. Please try right-clicking and "Save image as".',
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="space-y-6">

      {/* What's Included */}
      <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center shadow-lg border border-purple-500/30">
              <Settings className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-white">
              WHAT'S INCLUDED
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg border border-green-500/30">
                <Hash className="w-6 h-6 text-green-400" />
              </div>
              <p className="font-medium text-sm text-white">General Channel</p>
              <p className="text-xs text-purple-200">Text channel for discussions</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg border border-blue-500/30">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <p className="font-medium text-sm text-white">Moderation Tools</p>
              <p className="text-xs text-purple-200">Basic community management</p>
            </div>
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto shadow-lg border border-purple-500/30">
                <Users className="w-6 h-6 text-purple-400" />
              </div>
              <p className="font-medium text-sm text-white">Member Management</p>
              <p className="text-xs text-purple-200">User approval and roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Moderator Invitations Section */}
      {formData.name.trim() && (
        <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center shadow-lg border border-purple-500/30">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                INVITE MODERATORS
              </h3>
            </div>

            <p className="text-purple-200">
              Share this link with trusted users you want to make moderators. They'll be able to help manage your community.
            </p>

            <div className="space-y-4">
              {/* Moderator Invite Link */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-purple-200">Moderator Invite Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={moderatorJoinUrl}
                    readOnly
                    className="font-mono text-sm bg-slate-800/50 border-slate-700/50 text-white"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(moderatorJoinUrl, 'moderator-invite')}
                    className="bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"
                  >
                    {copiedField === 'moderator-invite' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-purple-300">
                  Send this to users you want to make moderators
                </p>
              </div>

              {/* Moderator QR Code */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-purple-200">QR Code</Label>
                  {moderatorQrCodeDataUrl && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyQRCodeAsImage(moderatorQrCodeDataUrl, 'moderator-qr')}
                        className="bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"
                      >
                        {copiedField === 'moderator-qr' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span className="ml-1">
                          {copiedField === 'moderator-qr' ? 'Copied!' : 'Copy'}
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQRCode(moderatorQrCodeDataUrl, `moderator-qr-${formData.name.replace(/\s+/g, '-').toLowerCase()}.png`)}
                        className="bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white"
                      >
                        <Download className="w-4 h-4" />
                        <span className="ml-1">Download</span>
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 bg-white rounded-lg p-2 flex items-center justify-center">
                    {isGeneratingModeratorQR ? (
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : moderatorQrCodeDataUrl ? (
                      <img src={moderatorQrCodeDataUrl} alt="Moderator QR Code" className="w-full h-full" />
                    ) : (
                      <QrCode className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-purple-300">
                      Scan this QR code to get the moderator invite link on mobile devices
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member Invitations Section */}
      {formData.name.trim() && (
        <div className='relative p-6 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/50'>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center shadow-lg border border-blue-500/30">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                INVITE MEMBERS
              </h3>
            </div>

            <p className="text-blue-200">
              Share this link with people you want to join your community. They'll need approval to become members.
            </p>

            <div className="space-y-4">
              {/* Member Join Link */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-blue-200">Member Join Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={memberJoinUrl}
                    readOnly
                    className="font-mono text-sm bg-slate-800/50 border-slate-700/50 text-white"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(memberJoinUrl, 'member-join')}
                    className="bg-slate-800/50 border-slate-700/50 text-blue-200 hover:bg-slate-700/50 hover:text-white"
                  >
                    {copiedField === 'member-join' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-blue-300">
                  Share this link to let people request to join your space
                </p>
              </div>

              {/* Member QR Code */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-blue-200">QR Code</Label>
                  {memberQrCodeDataUrl && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyQRCodeAsImage(memberQrCodeDataUrl, 'member-qr')}
                        className="bg-slate-800/50 border-slate-700/50 text-blue-200 hover:bg-slate-700/50 hover:text-white"
                      >
                        {copiedField === 'member-qr' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span className="ml-1">
                          {copiedField === 'member-qr' ? 'Copied!' : 'Copy'}
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadQRCode(memberQrCodeDataUrl, `member-qr-${formData.name.replace(/\s+/g, '-').toLowerCase()}.png`)}
                        className="bg-slate-800/50 border-slate-700/50 text-blue-200 hover:bg-slate-700/50 hover:text-white"
                      >
                        <Download className="w-4 h-4" />
                        <span className="ml-1">Download</span>
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 bg-white rounded-lg p-2 flex items-center justify-center">
                    {isGeneratingMemberQR ? (
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : memberQrCodeDataUrl ? (
                      <img src={memberQrCodeDataUrl} alt="Member QR Code" className="w-full h-full" />
                    ) : (
                      <QrCode className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-blue-300">
                      Scan this QR code to get the member join link on mobile devices
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onPrevious} className="bg-slate-800/50 border-slate-700/50 text-purple-200 hover:bg-slate-700/50 hover:text-white rounded-full">
          Previous
        </Button>
        <Button onClick={onCreateCommunity} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform transition-all duration-200 hover:scale-105 shadow-lg shadow-purple-500/25 rounded-full">
          Create Community
        </Button>
      </div>
    </div>
  );
}