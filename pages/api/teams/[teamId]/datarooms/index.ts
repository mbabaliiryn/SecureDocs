import { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import slugify from "@sindresorhus/slugify";
import { getServerSession } from "next-auth/next";
import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/teams/:teamId/datarooms
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const userId = (session.user as CustomUser).id;
    const { teamId } = req.query as { teamId: string };

    try {
      // Check if the user is part of the team
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
      });

      if (!team) {
        return res.status(401).end("Unauthorized");
      }

      const datarooms = await prisma.dataroom.findMany({
        where: {
          teamId: teamId,
        },
        include: {
          _count: {
            select: { documents: true, views: true },
          },
        },
      });

      return res.status(200).json(datarooms);
    } catch (error) {
      console.error("Request error", error);
      return res.status(500).json({ error: "Error fetching datarooms" });
    }
  } else if (req.method === "POST") {
    // POST /api/teams/:teamId/datarooms
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      res.status(401).end("Unauthorized");
      return;
    }

    const userId = (session.user as CustomUser).id;
    const { teamId } = req.query as { teamId: string };
    const { name } = req.body as { name: string };

    try {
      // Only check if user is part of the team, remove plan restrictions
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
      });

      if (!team) {
        return res.status(401).end("Unauthorized");
      }

      // Remove dataroom limit check
      const pId = newId("dataroom");

      const dataroom = await prisma.dataroom.create({
        data: {
          name: name,
          teamId: teamId,
          pId: pId,
        },
      });

      const dataroomWithCount = {
        ...dataroom,
        _count: { documents: 0 },
      };

      res.status(201).json(dataroomWithCount);
    } catch (error) {
      console.error("Request error", error);
      res.status(500).json({ error: "Error creating dataroom" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}