/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import mongoose, {
  ClientSession,
  Document,
  FilterQuery,
  Model,
  PipelineStage,
  UpdateQuery,
} from "mongoose";
import { PaginationDefaults } from "../enums/pagination_defaults.enum";
import { Pagination } from "../interfaces/pagination.interface";
import { IDbPagination } from "./db_pagination.interface";
import { IAggregationResultTotalSize } from "../enums/aggregation_result_total_size.interface";

export abstract class BaseRepository<T extends Document> {
  constructor(readonly model: Model<T>) {}

  async startSession(): Promise<ClientSession> {
    try {
      const _session = await this.model.startSession();

      return _session;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async endSession(session: ClientSession): Promise<boolean> {
    try {
      await session.endSession();

      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  /**
   * get total length of documents
   * @returns
   */
  async getSize(): Promise<number> {
    try {
      return await this.model.length;
    } catch (err) {
      console.log(err);
      return 0;
    }
  }

  /**
   * @description check if doc exists
   * @param q
   * @returns
   */
  async exists(
    q: mongoose.FilterQuery<T>,
    session?: ClientSession,
  ): Promise<boolean> {
    try {
      const doc = session
        ? await this.model.exists(q).session(session)
        : await this.model.exists(q);

      return !!doc;
    } catch (err) {
      console.log(err);
      return false;
    }
  }

  /**
   * @description count number of documents that match query
   * @returns
   */
  async count(
    q: mongoose.FilterQuery<T>,
    session?: ClientSession,
  ): Promise<number> {
    try {
      return session
        ? await this.model.countDocuments(q).session(session)
        : await this.model.countDocuments(q);
    } catch (err) {
      console.log(err);
      return 0;
    }
  }

  async aggregate<R>(
    filter: mongoose.FilterQuery<T>,
    pipeline: Array<PipelineStage>,
    projection?: mongoose.ProjectionFields<T>,
    pagination: IDbPagination = {
      itemsPerPage: PaginationDefaults.itemsPerPage,
      page: PaginationDefaults.page,
    },
    session?: ClientSession,
  ): Promise<Pagination<R>> {
    try {
      // construct the pipeline
      const _pipeline: PipelineStage[] = [];

      if (filter && Object.keys(filter).length > 0) {
        _pipeline.push({ $match: filter });
      }

      _pipeline.push(...pipeline);

      if (projection && Object.keys(projection).length > 0) {
        _pipeline.push({ $project: projection });
      }

      // paginate
      const page =
        !pagination?.page ||
        isNaN(Number(pagination.page)) ||
        pagination.page == 0
          ? PaginationDefaults.page
          : Math.abs(pagination.page);
      const itemsPerPage =
        !pagination?.itemsPerPage ||
        isNaN(Number(pagination.itemsPerPage)) ||
        pagination.itemsPerPage == 0
          ? PaginationDefaults.itemsPerPage
          : Math.abs(pagination.itemsPerPage);

      const _itemsPerPage = itemsPerPage * 1;
      const _page = (page - 1) * itemsPerPage;

      const total = await this.model.estimatedDocumentCount();

      _pipeline.push({ $skip: _page });
      _pipeline.push({ $limit: _itemsPerPage });

      const _result = session
        ? await this.model.aggregate(_pipeline).session(session)
        : await this.model.aggregate(_pipeline);

      const _paginated: Pagination<R> = {
        items: _result,
        currentPage: Number(page),
        totalPages: this.calculateTotalPages(
          itemsPerPage > _result?.length ? page * itemsPerPage : total,
          itemsPerPage,
        ),
        pageSize: _result?.length,
      };

      return _paginated;
    } catch (err) {
      console.log(err);
      return { items: [], currentPage: 1, totalPages: 1, pageSize: 0 };
    }
  }

  private async getAggregationResultTotalSize(
    pipeline: PipelineStage[],
    session?: ClientSession,
  ): Promise<IAggregationResultTotalSize> {
    try {
      // the last two stages in the pipeline are always for pagination so we'd have to remove them.
      const _pipeline = pipeline.slice(0, -2);

      if (_pipeline.length < 1) {
        return { size: 0 };
      }

      // add a count stage
      _pipeline.push({
        $count: "size",
      });

      const result = session
        ? await this.model.aggregate(_pipeline).session(session)
        : await this.model.aggregate(_pipeline);

      return (
        result[0] || ({ size: 0 } as unknown as IAggregationResultTotalSize)
      );
    } catch (err) {
      console.log(err);
      return { size: 0 };
    }
  }

  /**
   * @description create document
   * @param doc
   * @param saveOptions
   * @returns
   */
  async create(doc: Partial<T>): Promise<T> {
    try {
      const result = await this.model.create(doc);
      return (result as any)?._doc;

    } catch (err) {
      console.log(err);
      return null;
    }
  }

  /**
   * @description insert many document
   * @param doc
   * @param saveOptions
   * @returns
   */
  async createMany(
    docs: Array<Partial<T>>,
    session?: ClientSession,
  ): Promise<T[]> {
    try {
      return (await this.model.insertMany(docs, { session })) as any;
    } catch (err) {
      console.log(err);
      return [];
    }
  }

  /**
   * @description get docs by query
   * @param q
   * @returns
   */
  async queryAll(
    q: mongoose.FilterQuery<T>,
    projection?: mongoose.ProjectionType<T>,
    pagination: IDbPagination = {
      itemsPerPage: PaginationDefaults.itemsPerPage,
      page: PaginationDefaults.page,
    },
    session?: ClientSession,
  ): Promise<Pagination<T>> {
    try {
      let result;

      const page =
        !pagination.page ||
        isNaN(Number(pagination.page)) ||
        pagination.page == 0
          ? PaginationDefaults.page
          : pagination.page;
      const itemsPerPage =
        !pagination.itemsPerPage ||
        isNaN(Number(pagination.itemsPerPage)) ||
        pagination.itemsPerPage == 0
          ? PaginationDefaults.itemsPerPage
          : pagination.itemsPerPage;

      if (projection) {
        result = await this.model
          .find(q, projection)
          .skip((page - 1) * itemsPerPage)
          .limit(itemsPerPage * 1)
          .session(session)
          .exec();
      } else {
        result = await this.model
          .find(q)
          .skip((page - 1) * itemsPerPage)
          .limit(itemsPerPage * 1)
          .session(session)
          .exec();
      }

      const data = result ? result.map((doc) => doc?._doc) : [];

      const totalSize = await this.count(q);

      const paginated: Pagination<T> = {
        items: data,
        currentPage: Number(page),
        totalPages: Number(this.calculateTotalPages(totalSize, itemsPerPage)),
        pageSize: Number(data.length),
      };

      return paginated;
    } catch (err) {
      console.log(err);

      return { items: [], currentPage: 1, totalPages: 1, pageSize: 0 };
    }
  }

  /**
   * @description get specific doc by query
   * @param q
   * @returns
   */
  async query(
    q: mongoose.FilterQuery<T>,
    projection?: mongoose.ProjectionType<T>,
    session?: ClientSession,
  ): Promise<T> {
    try {
      const result = projection
        ? await this.model.findOne(q, projection).session(session)
        : await this.model.findOne(q).session(session);

      return (result as any)?._doc;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  /**
   * @description update multiple documents
   * @param q
   * @param u
   */
  async updateAll(
    q: mongoose.FilterQuery<T>,
    u: mongoose.UpdateQuery<T> | mongoose.UpdateWithAggregationPipeline,
    session?: ClientSession,
  ): Promise<mongoose.UpdateWriteOpResult> {
    try {
      const result = session
        ? await this.model.updateMany(q, u).session(session)
        : this.model.updateMany(q, u);
      return result;
    } catch (err) {
      console.log(err);
      return {
        acknowledged: false,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: 0,
        upsertedId: null,
      };
    }
  }

  /**
   * @description update a document and return the updated version of the document (doesn't support session)
   * @param filter the filter to use and find the document
   * @param update the update query
   * @returns
   */
  async updateOne(
    filter: FilterQuery<T>,
    update: UpdateQuery<T & Document>,
    projection?: mongoose.ProjectionType<T>,
  ): Promise<T> {
    try {
      const result = await this.model.findOneAndUpdate(filter, update);

      if (result) {
        const updated = await this.model.findOne(filter, projection);
        return updated;
      }

      return null;
    } catch (err) {
      // The update payload is deliberately not logged: it can carry password
      // hashes and profile PII.
      console.log(
        "----- db update error ------- ",
        JSON.stringify(filter),
        err,
      );
      return null;
    }
  }

  /**
   * @description update single item
   * @param q
   * @param u
   */
  async update(
    filter: FilterQuery<T>,
    update: UpdateQuery<T & Document>,
    session?: ClientSession,
  ): Promise<T> {
    try {
      const result = session
        ? await this.model.findOneAndUpdate(filter, update)?.session(session)
        : await this.model.findOneAndUpdate(filter, update);

      if (result) {
        const updated = await this.model.findOne(filter);
        return updated;
      }

      return null;
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  /**
   * @description delete
   * @param q
   */
  async delete(
    q: mongoose.FilterQuery<T>,
    session?: ClientSession,
  ): Promise<T> {
    try {
      return session
        ? await this.model.findOneAndDelete(q).session(session)
        : this.model.findOneAndDelete(q);
    } catch (err) {
      return null;
    }
  }

  /**
   * @description delete
   * @param q
   */
  async deleteAll(
    q: mongoose.FilterQuery<T>,
    session?: ClientSession,
  ): Promise<boolean> {
    try {
      const result = session
        ? await this.model.deleteMany(q).session(session)
        : await this.model.deleteMany(q);
      return result.deletedCount > 0;
    } catch (err) {
      return false;
    }
  }

  private calculateTotalPages(dataSize: number, itemsPerPage: number): number {
    // determine total pages
    const pageLength = dataSize / itemsPerPage;
    const roundedPageLength = Math.round(pageLength);

    const totalPages =
      roundedPageLength < pageLength && roundedPageLength != pageLength
        ? roundedPageLength + 1
        : roundedPageLength;

    return totalPages;
  }
}
