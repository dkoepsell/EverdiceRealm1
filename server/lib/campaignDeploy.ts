import { Express, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { storage } from '../storage';
import { Campaign } from '@shared/schema';

// Generate a unique deployment code
export function generateDeploymentCode(length: number = 8): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase();
}

// Register campaign deployment routes
export function registerCampaignDeploymentRoutes(app: Express) {
  // Publish a campaign
  app.post('/api/campaigns/:id/publish', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    const { isPrivate = true, maxPlayers = 6 } = req.body;
    const userId = req.user!.id;

    try {
      // Get the campaign
      const campaign = await storage.getCampaign(parseInt(id));

      // Verify ownership
      if (!campaign || campaign.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to publish this campaign' });
      }

      // Generate a deployment code if private
      const deploymentCode = isPrivate ? generateDeploymentCode() : null;

      // Update the campaign
      const updatedCampaign = await storage.updateCampaign(parseInt(id), {
        isPublished: true,
        publishedAt: new Date().toISOString(),
        isPrivate,
        maxPlayers,
        deploymentCode
      });

      res.status(200).json(updatedCampaign!);
    } catch (error) {
      console.error('Error publishing campaign:', error);
      res.status(500).json({ message: 'Failed to publish campaign' });
    }
  });

  // Unpublish a campaign
  app.post('/api/campaigns/:id/unpublish', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    const userId = req.user!.id;

    try {
      // Get the campaign
      const campaign = await storage.getCampaign(parseInt(id));

      // Verify ownership
      if (!campaign || campaign.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to unpublish this campaign' });
      }

      // Update the campaign
      const updatedCampaign = await storage.updateCampaign(parseInt(id), {
        isPublished: false
      });

      res.status(200).json(updatedCampaign!);
    } catch (error) {
      console.error('Error unpublishing campaign:', error);
      res.status(500).json({ message: 'Failed to unpublish campaign' });
    }
  });

  // Update deployment settings
  app.patch('/api/campaigns/:id/deployment-settings', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    const { isPrivate, maxPlayers } = req.body;
    const userId = req.user!.id;

    try {
      // Get the campaign
      const campaign = await storage.getCampaign(parseInt(id));

      // Verify ownership
      if (!campaign || campaign.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this campaign' });
      }

      // Prepare updates
      const updates: Partial<Campaign> = {};
      
      if (isPrivate !== undefined) {
        updates.isPrivate = isPrivate;
      }
      
      if (maxPlayers !== undefined) {
        updates.maxPlayers = maxPlayers;
      }

      // Update the campaign
      const updatedCampaign = await storage.updateCampaign(parseInt(id), updates);

      res.status(200).json(updatedCampaign!);
    } catch (error) {
      console.error('Error updating deployment settings:', error);
      res.status(500).json({ message: 'Failed to update deployment settings' });
    }
  });

  // Generate a new deployment code
  app.post('/api/campaigns/:id/generate-code', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    const userId = req.user!.id;

    try {
      // Get the campaign
      const campaign = await storage.getCampaign(parseInt(id));

      // Verify ownership
      if (!campaign || campaign.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to generate a code for this campaign' });
      }

      // Generate a new deployment code
      const deploymentCode = generateDeploymentCode();

      // Update the campaign
      await storage.updateCampaign(parseInt(id), { deploymentCode });

      res.status(200).json({ deploymentCode });
    } catch (error) {
      console.error('Error generating code:', error);
      res.status(500).json({ message: 'Failed to generate code' });
    }
  });

  // Unlink campaign from Discord
  app.post('/api/campaigns/:id/unlink-discord', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    const userId = req.user!.id;

    try {
      // Get the campaign
      const campaign = await storage.getCampaign(parseInt(id));

      // Verify ownership
      if (!campaign || campaign.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to unlink this campaign' });
      }

      // Check if campaign is deployed to Discord
      if (!campaign.isDiscordDeployed) {
        return res.status(400).json({ message: 'Campaign is not deployed to Discord' });
      }

      // Unlink from Discord
      const updatedCampaign = await storage.updateCampaign(parseInt(id), {
        discordGuildId: null,
        discordChannelId: null,
        isDiscordDeployed: false
      });

      res.status(200).json(updatedCampaign!);
    } catch (error) {
      console.error('Error unlinking campaign from Discord:', error);
      res.status(500).json({ message: 'Failed to unlink campaign from Discord' });
    }
  });

  // Get campaign by deployment code
  app.get('/api/campaigns/by-code/:code', async (req, res) => {
    const { code } = req.params;

    try {
      const campaigns = await storage.getAllCampaigns();
      const campaign = campaigns.find(c => c.deploymentCode === code && c.isPublished);

      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Get participant count
      const participants = await storage.getCampaignParticipants(campaign.id);
      
      // Return a limited version of the campaign without sensitive information
      res.status(200).json({
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        difficulty: campaign.difficulty,
        narrativeStyle: campaign.narrativeStyle,
        createdAt: campaign.createdAt,
        maxPlayers: campaign.maxPlayers,
        participantCount: participants.length
      });
    } catch (error) {
      console.error('Error finding campaign by code:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // Join a campaign by code
  app.post('/api/campaigns/join/:code', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { code } = req.params;
    const { characterId } = req.body;
    const userId = req.user!.id;

    if (!characterId) {
      return res.status(400).json({ message: 'Character ID is required' });
    }

    try {
      const campaigns = await storage.getAllCampaigns();
      const campaign = campaigns.find(c => c.deploymentCode === code && c.isPublished);

      if (!campaign) {
        return res.status(404).json({ message: 'Campaign not found' });
      }

      // Check if the user is already a participant
      const existingParticipant = await storage.getCampaignParticipant(campaign.id, userId);
      if (existingParticipant) {
        return res.status(400).json({ message: 'Already a participant in this campaign' });
      }

      // Check if max players reached
      const participants = await storage.getCampaignParticipants(campaign.id);
      if (campaign.maxPlayers && participants.length >= campaign.maxPlayers) {
        return res.status(400).json({ message: 'Campaign is full' });
      }

      // Add participant
      const participant = await storage.addCampaignParticipant({
        campaignId: campaign.id,
        userId,
        characterId,
        role: 'player',
        joinedAt: new Date().toISOString()
      });

      res.status(201).json(participant);
    } catch (error) {
      console.error('Error joining campaign:', error);
      res.status(500).json({ message: 'Failed to join campaign' });
    }
  });
}